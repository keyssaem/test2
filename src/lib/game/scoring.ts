import type { RubricItem, TargetImage } from "@/content/levels";
import type { ScoreResult } from "./types";

export const MAX_PROMPT_LENGTH = 100;

/** 공백·문장부호를 없애 "빨간 사과" 와 "빨간사과" 를 같게 본다. */
export function normalize(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[\s.,!?~'"“”‘’()\[\]{}·…\-_/\\]+/g, "");
}

/** 오프라인 채점: 각 채점 요소의 어간이 프롬프트에 들어 있는지 본다. */
export function keywordScore(image: TargetImage, prompt: string): ScoreResult {
  const text = normalize(prompt);
  const matched = image.rubric
    .filter((item) => item.keywords.some((k) => text.includes(normalize(k))))
    .map((item) => item.id);
  return { matched, source: "keyword" };
}

/** 맞힌 요소 비율로 0~100 점수를 계산한다 (요소마다 같은 비중). */
export function computeScore(rubric: RubricItem[], matched: string[]): number {
  if (rubric.length === 0) return 0;
  const valid = new Set(rubric.map((r) => r.id));
  const hits = new Set(matched.filter((m) => valid.has(m))).size;
  return Math.round((hits / rubric.length) * 100);
}

/** 빠진 요소의 힌트를 최대 n개, AI 팁이 있으면 맨 앞에. */
export function buildTips(rubric: RubricItem[], matched: string[], aiTip?: string, n = 2): string[] {
  const missing = rubric.filter((r) => !matched.includes(r.id)).map((r) => r.hint);
  const tips = aiTip ? [aiTip, ...missing] : missing;
  return [...new Set(tips)].slice(0, n);
}
