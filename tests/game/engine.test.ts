import { describe, expect, it } from "vitest";
import { LEVELS, LAST_LEVEL } from "@/content/levels";
import { applyAttempt, initialProgress } from "@/lib/game/engine";
import type { Progress } from "@/lib/game/types";

const now = "2026-11-25T00:00:00.000Z";
const pass = { score: 100, passed: true, prompt: "ok" };
const fail = { score: 10, passed: false, prompt: "no" };

function run(p: Progress, ...attempts: (typeof pass)[]) {
  let cur = p;
  let last;
  for (const a of attempts) {
    last = applyAttempt(cur, a, now);
    cur = last.progress;
  }
  return { p: cur, last: last! };
}

describe("게임 진행", () => {
  const start = initialProgress("s1", "c1", now);

  it("처음엔 레벨 1, 첫 그림, 기회 3번", () => {
    expect(start).toMatchObject({ levelId: 1, imageIndex: 0, attemptsLeft: 3, status: "playing" });
  });

  it("틀리면 기회가 줄고 같은 그림 유지", () => {
    const { p, last } = run(start, fail);
    expect(last.outcome).toBe("retry");
    expect(p).toMatchObject({ imageIndex: 0, attemptsLeft: 2 });
    expect(last.imageFinished).toBe(false);
  });

  it("통과하면 다음 그림, 기회 초기화, 모범 설명 공개", () => {
    const { p, last } = run(start, fail, pass);
    expect(last.outcome).toBe("image-passed");
    expect(last.imageFinished).toBe(true);
    expect(p).toMatchObject({ imageIndex: 1, attemptsLeft: 3, levelPassed: 1, passedCount: 1 });
  });

  it("3번 다 틀리면 그림 실패로 다음 그림", () => {
    const { p, last } = run(start, fail, fail, fail);
    expect(last.outcome).toBe("image-failed");
    expect(p).toMatchObject({ imageIndex: 1, attemptsLeft: 3, levelPassed: 0 });
  });

  it("레벨 그림의 절반 이상 통과하면 레벨업", () => {
    const { p, last } = run(start, fail, fail, fail, pass); // 2장 중 1장 통과
    expect(last.outcome).toBe("level-up");
    expect(p).toMatchObject({ levelId: 2, imageIndex: 0, levelPassed: 0, passedCount: 1, status: "playing" });
  });

  it("레벨에서 하나도 통과 못 하면 같은 레벨 처음부터, 상태 stuck", () => {
    const { p, last } = run(start, fail, fail, fail, fail, fail, fail);
    expect(last.outcome).toBe("level-retry");
    expect(p).toMatchObject({ levelId: 1, imageIndex: 0, status: "stuck" });
  });

  it("마지막 레벨까지 통과하면 done, 이후 시도는 무시", () => {
    const allPasses = LEVELS.flatMap((l) => l.images.map(() => pass));
    const { p, last } = run(start, ...allPasses);
    expect(last.outcome).toBe("done");
    expect(p.status).toBe("done");
    expect(p.levelId).toBe(LAST_LEVEL);
    expect(applyAttempt(p, pass, now).progress).toBe(p);
  });

  it("원래 상태 객체를 바꾸지 않는다", () => {
    const copy = { ...start };
    applyAttempt(start, fail, now);
    expect(start).toEqual(copy);
  });
});
