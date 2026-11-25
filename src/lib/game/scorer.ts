import "server-only";
import { serverEnv } from "@/lib/server-env";
import { createClaudeScorer } from "./claude-scorer";
import { keywordScore } from "./scoring";
import type { Scorer } from "./service";

/** API 키가 있으면 Claude로 채점하고, 실패하면 키워드 채점으로 대신한다. */
export function getScorer(): Scorer {
  const env = serverEnv();
  if (!env.ANTHROPIC_API_KEY) return async (image, prompt) => keywordScore(image, prompt);

  const claude = createClaudeScorer({ apiKey: env.ANTHROPIC_API_KEY, model: env.CLAUDE_MODEL });
  return async (image, prompt) => {
    try {
      return await claude(image, prompt);
    } catch (err) {
      console.error("[prompt-quest] AI 채점 실패, 키워드 채점으로 대체:", err instanceof Error ? err.message : err);
      return keywordScore(image, prompt);
    }
  };
}
