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

  it("비밀값이 빠지면 실패", () => {
    expect(() => parseServerEnv({ ...ok, ANTHROPIC_API_KEY: undefined })).toThrow();
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
