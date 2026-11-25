import { randomUUID } from "node:crypto";
import { z } from "zod";
import { LEVELS, type TargetImage } from "@/content/levels";
import type { GameRepo } from "@/lib/data/repo";
import type { StudentSession } from "@/lib/student-session";
import { applyAttempt, currentImage, currentLevel, initialProgress, levelPassRequirement, type Outcome } from "./engine";
import { containsPersonalInfo, isInappropriate } from "./moderation";
import { buildTips, computeScore, MAX_PROMPT_LENGTH } from "./scoring";
import type { Progress, ScoreResult } from "./types";

export type Scorer = (image: TargetImage, prompt: string) => Promise<ScoreResult>;

export class GameError extends Error {
  constructor(
    public code: "BAD_INPUT" | "CLASS_NOT_FOUND" | "PAUSED" | "NO_SESSION" | "DONE" | "RATE_LIMITED",
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ── 입장 ─────────────────────────────────────────────────────────
export const JoinInput = z.object({
  code: z.string().trim().regex(/^[A-Za-z0-9]{6}$/, "학급 코드는 영문·숫자 6자리예요."),
  number: z.coerce.number().int().min(1, "번호는 1~60 사이예요.").max(60, "번호는 1~60 사이예요."),
  nickname: z
    .string()
    .trim()
    .min(1, "별명을 적어 주세요.")
    .max(12, "별명은 12자까지예요.")
    .regex(/^[가-힣a-zA-Z0-9 ]+$/, "별명은 한글·영문·숫자만 쓸 수 있어요."),
});

export async function joinClass(repo: GameRepo, raw: unknown, now = new Date().toISOString()) {
  const parsed = JoinInput.safeParse(raw);
  if (!parsed.success) throw new GameError("BAD_INPUT", parsed.error.issues[0].message);
  const { code, number, nickname } = parsed.data;

  const cls = await repo.findClassByCode(code.toUpperCase());
  if (!cls) throw new GameError("CLASS_NOT_FOUND", "학급 코드를 다시 확인해 주세요.", 404);

  const student = await repo.upsertStudent(cls.id, number, nickname);
  if (!(await repo.getProgress(student.id))) {
    await repo.saveProgress(initialProgress(student.id, cls.id, now));
  }
  return { student, cls };
}

// ── 화면 상태 ────────────────────────────────────────────────────
export async function loadContext(repo: GameRepo, session: StudentSession | null) {
  if (!session) throw new GameError("NO_SESSION", "먼저 학급에 입장해 주세요.", 401);
  const [student, cls, progress] = await Promise.all([
    repo.getStudent(session.studentId),
    repo.getClass(session.classId),
    repo.getProgress(session.studentId),
  ]);
  if (!student || !cls || !progress || student.classId !== cls.id) {
    throw new GameError("NO_SESSION", "다시 입장해 주세요.", 401);
  }
  return { student, cls, progress };
}

export async function getStudentView(repo: GameRepo, session: StudentSession | null) {
  const { student, cls, progress } = await loadContext(repo, session);
  return buildView(repo, student.number, student.nickname, cls.name, cls.isPaused, progress);
}

async function buildView(repo: GameRepo, number: number, nickname: string, className: string, isPaused: boolean, p: Progress) {
  const level = currentLevel(p);
  const image = currentImage(p);
  const history = p.status === "done" ? [] : await repo.listAttempts(p.studentId, image.id);
  return {
    className,
    isPaused,
    student: { number, nickname },
    totalLevels: LEVELS.length,
    level: {
      id: level.id,
      title: level.title,
      description: level.description,
      checklist: level.checklist,
      passThreshold: level.passThreshold,
      maxAttempts: level.maxAttempts,
      imageCount: level.images.length,
      needToPass: levelPassRequirement(level),
    },
    // 정답(referencePrompt·rubric 키워드)은 보내지 않는다
    image: { id: image.id, src: image.src, alt: image.alt, index: p.imageIndex },
    attemptsLeft: p.attemptsLeft,
    levelPassed: p.levelPassed,
    passedCount: p.passedCount,
    status: p.status,
    history: history.map((h) => ({ prompt: h.prompt, score: h.score, passed: h.passed })),
  };
}

export type StudentView = Awaited<ReturnType<typeof buildView>>;

// ── 제출 ─────────────────────────────────────────────────────────
export const AttemptInput = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, "조금 더 자세히 적어 볼까요?")
    .max(MAX_PROMPT_LENGTH, `${MAX_PROMPT_LENGTH}자까지 쓸 수 있어요.`),
});

export type AttemptResult = {
  score: number;
  passed: boolean;
  matchedLabels: string[];
  missingLabels: string[];
  tips: string[];
  outcome: Outcome | "blocked";
  reference: string | null; // 그림이 끝났을 때만 모범 프롬프트 공개
  scoredBy: ScoreResult["source"] | "moderation";
  view: StudentView;
};

export async function submitAttempt(
  repo: GameRepo,
  scorer: Scorer,
  session: StudentSession | null,
  raw: unknown,
  now = new Date().toISOString(),
): Promise<AttemptResult> {
  const { student, cls, progress } = await loadContext(repo, session);
  if (cls.isPaused) throw new GameError("PAUSED", "선생님이 잠시 멈췄어요. 기다려 주세요!", 423);
  if (progress.status === "done") throw new GameError("DONE", "모든 레벨을 끝냈어요!", 409);

  const parsed = AttemptInput.safeParse(raw);
  if (!parsed.success) throw new GameError("BAD_INPUT", parsed.error.issues[0].message);
  const prompt = parsed.data.prompt;

  const level = currentLevel(progress);
  const image = currentImage(progress);
  const view = () => buildView(repo, student.number, student.nickname, cls.name, cls.isPaused, progress);

  // 1) 부적절하거나 개인정보가 섞인 입력: AI로 보내지 않고 기회도 깎지 않음, 교사에게 표시
  const personal = containsPersonalInfo(prompt);
  if (personal || isInappropriate(prompt)) {
    await repo.addAttempt({
      id: randomUUID(),
      studentId: student.id,
      classId: cls.id,
      imageId: image.id,
      prompt: personal ? "[개인정보로 보이는 내용이 있어 저장하지 않음]" : prompt,
      score: 0,
      feedback: personal ? "개인정보 의심" : "부적절한 표현",
      passed: false,
      flagged: true,
      createdAt: now,
    });
    return {
      score: 0,
      passed: false,
      matchedLabels: [],
      missingLabels: [],
      tips: [personal ? "전화번호나 이메일 같은 개인정보는 쓰지 않아요." : "고운 말로 그림을 다시 설명해 볼까요?"],
      outcome: "blocked",
      reference: null,
      scoredBy: "moderation",
      view: await view(),
    };
  }

  // 2) 채점
  const result = await scorer(image, prompt);
  const score = computeScore(image.rubric, result.matched);
  const passed = !result.inappropriate && score >= level.passThreshold;
  const tips = passed ? [] : buildTips(image.rubric, result.matched, result.tip);

  await repo.addAttempt({
    id: randomUUID(),
    studentId: student.id,
    classId: cls.id,
    imageId: image.id,
    prompt,
    score,
    feedback: tips.join(" / "),
    passed,
    flagged: !!result.inappropriate,
    createdAt: now,
  });

  // 3) 진행 상태 갱신
  const { progress: next, outcome, imageFinished } = applyAttempt(progress, { score, passed, prompt }, now);
  await repo.saveProgress(next);

  return {
    score,
    passed,
    matchedLabels: image.rubric.filter((r) => result.matched.includes(r.id)).map((r) => r.label),
    missingLabels: image.rubric.filter((r) => !result.matched.includes(r.id)).map((r) => r.label),
    tips,
    outcome,
    reference: imageFinished ? image.referencePrompt : null,
    scoredBy: result.source,
    view: await buildView(repo, student.number, student.nickname, cls.name, cls.isPaused, next),
  };
}
