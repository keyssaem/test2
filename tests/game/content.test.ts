import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LEVELS } from "@/content/levels";
import { computeScore, keywordScore } from "@/lib/game/scoring";

const images = LEVELS.flatMap((l) => l.images.map((img) => ({ level: l, img })));

describe("레벨 콘텐츠", () => {
  it("레벨은 1부터 연속이고 통과 기준이 점점 올라간다", () => {
    LEVELS.forEach((l, i) => expect(l.id).toBe(i + 1));
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].passThreshold).toBeGreaterThanOrEqual(LEVELS[i - 1].passThreshold);
    }
  });

  it("그림 id가 겹치지 않는다", () => {
    const ids = images.map((x) => x.img.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(images)("$img.id: 그림 파일이 있다", ({ img }) => {
    expect(existsSync(`public${img.src}`)).toBe(true);
  });

  it.each(images)("$img.id: 모범 설명은 키워드 채점으로도 통과한다", ({ level, img }) => {
    const score = computeScore(img.rubric, keywordScore(img, img.referencePrompt).matched);
    expect(score).toBeGreaterThanOrEqual(level.passThreshold);
  });

  it.each(images)("$img.id: alt 글에 정답이 드러나지 않는다", ({ img }) => {
    for (const r of img.rubric) for (const k of r.keywords) expect(img.alt.includes(k) && k.length > 1).toBe(false);
  });
});
