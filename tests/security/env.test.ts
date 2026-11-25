import { describe, expect, it } from "vitest";
import { parsePublicEnv } from "@/lib/env";
import { parseServerEnv } from "@/lib/server-env";

const ok = {
  SUPABASE_SERVICE_ROLE_KEY: "s".repeat(40),
  ANTHROPIC_API_KEY: "a".repeat(40),
  STUDENT_SESSION_SECRET: "z".repeat(64),
};

describe("환경변수 검증", () => {
  it("서버 비밀값이 모두 있으면 통과", () => {
    expect(parseServerEnv(ok).ANTHROPIC_API_KEY).toHaveLength(40);
  });

  it("AI 키가 없으면(빈 값 포함) 키워드 채점 모드로 통과", () => {
    expect(parseServerEnv({ ...ok, ANTHROPIC_API_KEY: "" }).ANTHROPIC_API_KEY).toBeUndefined();
  });

  it("기본 저장소는 memory, 기본 모델은 claude-opus-5-5", () => {
    const env = parseServerEnv(ok);
    expect(env.DATA_BACKEND).toBe("memory");
    expect(env.CLAUDE_MODEL).toBe("claude-opus-5-5");
  });

  it("supabase 저장소인데 service_role 키가 없으면 실패", () => {
    expect(() => parseServerEnv({ ...ok, DATA_BACKEND: "supabase", SUPABASE_SERVICE_ROLE_KEY: "" })).toThrow(/SERVICE_ROLE/);
  });

  it("세션 비밀값이 없으면 실패", () => {
    expect(() => parseServerEnv({ ...ok, STUDENT_SESSION_SECRET: undefined })).toThrow();
  });

  it("세션 비밀값이 32자 미만이면 실패", () => {
    expect(() => parseServerEnv({ ...ok, STUDENT_SESSION_SECRET: "short" })).toThrow();
  });

  it("비밀값을 NEXT_PUBLIC_ 으로 노출하면 실패", () => {
    expect(() => parseServerEnv({ ...ok, NEXT_PUBLIC_ANTHROPIC_API_KEY: "x" })).toThrow(/NEXT_PUBLIC_/);
  });

  it("공개 값은 URL 형식이어야 한다", () => {
    expect(() => parsePublicEnv({ NEXT_PUBLIC_SUPABASE_URL: "not-a-url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "k".repeat(30) })).toThrow();
  });
});
