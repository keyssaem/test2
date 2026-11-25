import { describe, expect, it } from "vitest";
import { LEVELS } from "@/content/levels";
import { containsPersonalInfo, isInappropriate } from "@/lib/game/moderation";
import { buildTips, computeScore, keywordScore, normalize } from "@/lib/game/scoring";

const apple = LEVELS[0].images[0];

describe("채점", () => {
  it("띄어쓰기·문장부호를 무시한다", () => {
    expect(normalize("빨간  사과!")).toBe(normalize("빨간사과"));
  });

  it("사물과 색을 모두 말하면 100점", () => {
    const r = keywordScore(apple, "빨간색 사과가 하나 있어요");
    expect(computeScore(apple.rubric, r.matched)).toBe(100);
  });

  it("'빨갛고' 같은 형용사 형태도 색깔로 인정", () => {
    expect(computeScore(apple.rubric, keywordScore(apple, "빨갛고 둥근 사과").matched)).toBe(100);
  });

  it("사물만 말하면 50점, 통과 기준(60) 미달", () => {
    const r = keywordScore(apple, "사과");
    const score = computeScore(apple.rubric, r.matched);
    expect(score).toBe(50);
    expect(score).toBeLessThan(LEVELS[0].passThreshold);
  });

  it("관계없는 설명은 0점", () => {
    expect(computeScore(apple.rubric, keywordScore(apple, "자동차가 달려요").matched)).toBe(0);
  });

  it("없는 rubric id나 중복은 점수에 반영되지 않는다", () => {
    expect(computeScore(apple.rubric, ["object", "object", "hack"])).toBe(50);
  });

  it("빠진 요소의 힌트를 주고, AI 팁은 맨 앞", () => {
    expect(buildTips(apple.rubric, ["object"])).toEqual([apple.rubric[1].hint]);
    expect(buildTips(apple.rubric, [], "AI 팁")[0]).toBe("AI 팁");
  });
});

describe("입력 검사", () => {
  it("욕설을 잡는다 (띄어 써도)", () => {
    expect(isInappropriate("시 발 사과")).toBe(true);
    expect(isInappropriate("빨간 사과")).toBe(false);
  });

  it("전화번호·이메일을 개인정보로 잡는다", () => {
    expect(containsPersonalInfo("010-1234-5678")).toBe(true);
    expect(containsPersonalInfo("kid@example.com")).toBe(true);
    expect(containsPersonalInfo("사과 3개와 바나나 2개")).toBe(false);
  });
});
