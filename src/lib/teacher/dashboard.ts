import { randomInt } from "node:crypto";
import { z } from "zod";
import { LEVELS, getLevel } from "@/content/levels";
import type { ClassData, TeacherRepo } from "@/lib/data/repo";
import { GameError } from "@/lib/game/service";

// 헷갈리는 글자(0/O, 1/I/L)를 뺀 학급 코드 문자
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateJoinCode(rand: (max: number) => number = randomInt): string {
  return Array.from({ length: 6 }, () => CODE_CHARS[rand(CODE_CHARS.length)]).join("");
}

export const ClassNameInput = z.object({
  name: z.string().trim().min(1, "학급 이름을 적어 주세요.").max(40, "학급 이름은 40자까지예요."),
});

export async function createClassWithCode(repo: TeacherRepo, teacherId: string, raw: unknown) {
  const parsed = ClassNameInput.safeParse(raw);
  if (!parsed.success) throw new GameError("BAD_INPUT", parsed.error.issues[0].message);
  for (let i = 0; i < 5; i++) {
    try {
      return await repo.createClass(teacherId, parsed.data.name, generateJoinCode());
    } catch (err) {
      if (!(err instanceof Error && err.message === "JOIN_CODE_TAKEN")) throw err;
    }
  }
  throw new Error("학급 코드를 만들지 못했습니다.");
}

function imageOf(levelId: number, imageIndex: number) {
  const level = getLevel(levelId);
  return level?.images[Math.min(imageIndex, level.images.length - 1)];
}

/** 대시보드 한 화면에 필요한 정보 (카드 1장 = 학생 1명) */
export function buildSnapshot(data: ClassData) {
  const attemptsByStudent = new Map<string, ClassData["attempts"]>();
  for (const a of data.attempts) {
    const list = attemptsByStudent.get(a.studentId) ?? [];
    list.push(a); // 이미 최신순
    attemptsByStudent.set(a.studentId, list);
  }
  const progressById = new Map(data.progress.map((p) => [p.studentId, p]));

  const students = data.students
    .map((s) => {
      const p = progressById.get(s.id);
      const list = attemptsByStudent.get(s.id) ?? [];
      const last = list[0];
      const image = p ? imageOf(p.levelId, p.imageIndex) : undefined;
      return {
        id: s.id,
        number: s.number,
        nickname: s.nickname,
        levelId: p?.levelId ?? 1,
        levelTitle: getLevel(p?.levelId ?? 1)?.title ?? "",
        imageIndex: p?.imageIndex ?? 0,
        imageSrc: image?.src ?? null,
        attemptsLeft: p?.attemptsLeft ?? 0,
        passedCount: p?.passedCount ?? 0,
        bestScore: p?.bestScore ?? 0,
        status: p?.status ?? "playing",
        attemptCount: list.length,
        flaggedCount: list.filter((a) => a.flagged).length,
        lastAttempt: last ? { prompt: last.prompt, score: last.score, passed: last.passed, flagged: last.flagged, at: last.createdAt } : null,
        updatedAt: last?.createdAt ?? p?.updatedAt ?? null,
      };
    })
    .sort((a, b) => a.number - b.number);

  const totalImages = LEVELS.reduce((n, l) => n + l.images.length, 0);
  return {
    class: data.cls,
    totalLevels: LEVELS.length,
    totalImages,
    summary: {
      students: students.length,
      done: students.filter((s) => s.status === "done").length,
      stuck: students.filter((s) => s.status === "stuck").length,
      flagged: students.filter((s) => s.flaggedCount > 0).length,
      attempts: data.attempts.length,
      levelCounts: LEVELS.map((l) => ({
        levelId: l.id,
        title: l.title,
        count: students.filter((s) => s.status !== "done" && s.levelId === l.id).length,
      })),
    },
    students,
  };
}

export type DashboardSnapshot = ReturnType<typeof buildSnapshot>;
export type DashboardStudent = DashboardSnapshot["students"][number];

/** 학생 한 명의 전체 시도 기록 (교사는 모범 설명도 볼 수 있다) */
export function buildStudentDetail(data: ClassData, studentId: string) {
  const student = data.students.find((s) => s.id === studentId);
  if (!student) return null;
  const images = new Map(LEVELS.flatMap((l) => l.images.map((img) => [img.id, { img, level: l }] as const)));
  const attempts = data.attempts
    .filter((a) => a.studentId === studentId)
    .slice()
    .reverse() // 오래된 것부터
    .map((a) => {
      const info = images.get(a.imageId);
      return {
        prompt: a.prompt,
        score: a.score,
        passed: a.passed,
        flagged: a.flagged,
        feedback: a.feedback,
        at: a.createdAt,
        imageId: a.imageId,
        imageSrc: info?.img.src ?? null,
        levelId: info?.level.id ?? null,
        reference: info?.img.referencePrompt ?? null,
      };
    });
  return { student: { id: student.id, number: student.number, nickname: student.nickname }, attempts };
}
