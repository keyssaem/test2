import { LEVELS, LAST_LEVEL, getLevel, type Level, type TargetImage } from "@/content/levels";
import type { Progress } from "./types";

export type Outcome =
  | "retry" // 기회가 남아 같은 그림 다시
  | "image-passed" // 통과 → 다음 그림
  | "image-failed" // 기회 소진 → 다음 그림
  | "level-up" // 레벨 통과
  | "level-retry" // 레벨 통과 기준 미달 → 같은 레벨 처음부터
  | "done"; // 마지막 레벨 완료

export function initialProgress(studentId: string, classId: string, now: string): Progress {
  const first = LEVELS[0];
  return {
    studentId,
    classId,
    levelId: first.id,
    imageIndex: 0,
    attemptsLeft: first.maxAttempts,
    levelPassed: 0,
    passedCount: 0,
    bestScore: 0,
    lastPrompt: null,
    status: "playing",
    updatedAt: now,
  };
}

export function currentLevel(p: Progress): Level {
  const level = getLevel(p.levelId);
  if (!level) throw new Error(`알 수 없는 레벨: ${p.levelId}`);
  return level;
}

export function currentImage(p: Progress): TargetImage {
  const level = currentLevel(p);
  return level.images[Math.min(p.imageIndex, level.images.length - 1)];
}

/** 레벨을 통과하려면 그림의 절반 이상(올림)을 통과해야 한다. */
export function levelPassRequirement(level: Level): number {
  return Math.ceil(level.images.length / 2);
}

/**
 * 시도 결과를 반영한 새 진행 상태를 돌려준다 (원본은 바꾸지 않음).
 * imageFinished 가 true 면 그 그림의 모범 프롬프트를 보여줘도 된다.
 */
export function applyAttempt(
  p: Progress,
  attempt: { score: number; passed: boolean; prompt: string },
  now: string,
): { progress: Progress; outcome: Outcome; imageFinished: boolean } {
  if (p.status === "done") return { progress: p, outcome: "done", imageFinished: false };

  const level = currentLevel(p);
  const next: Progress = {
    ...p,
    bestScore: Math.max(p.bestScore, attempt.score),
    lastPrompt: attempt.prompt,
    updatedAt: now,
  };

  if (attempt.passed) {
    next.levelPassed += 1;
    next.passedCount += 1;
  } else {
    next.attemptsLeft -= 1;
    if (next.attemptsLeft > 0) return { progress: next, outcome: "retry", imageFinished: false };
  }

  // 이 그림은 끝났다 → 다음 그림 또는 레벨 정산
  const isLastImage = next.imageIndex + 1 >= level.images.length;
  if (!isLastImage) {
    return {
      progress: { ...next, imageIndex: next.imageIndex + 1, attemptsLeft: level.maxAttempts, bestScore: 0 },
      outcome: attempt.passed ? "image-passed" : "image-failed",
      imageFinished: true,
    };
  }

  if (next.levelPassed >= levelPassRequirement(level)) {
    if (level.id >= LAST_LEVEL) {
      return { progress: { ...next, status: "done", attemptsLeft: 0 }, outcome: "done", imageFinished: true };
    }
    const upper = getLevel(level.id + 1)!;
    return {
      progress: {
        ...next,
        levelId: upper.id,
        imageIndex: 0,
        attemptsLeft: upper.maxAttempts,
        levelPassed: 0,
        bestScore: 0,
        status: "playing",
      },
      outcome: "level-up",
      imageFinished: true,
    };
  }

  return {
    progress: { ...next, imageIndex: 0, attemptsLeft: level.maxAttempts, levelPassed: 0, bestScore: 0, status: "stuck" },
    outcome: "level-retry",
    imageFinished: true,
  };
}
