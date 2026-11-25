import "server-only"; // 클라이언트 컴포넌트에서 import하면 빌드가 실패한다.
import { z } from "zod";

// .env 에 "KEY=" 처럼 빈 값으로 두면 '없음'으로 본다.
const optional = z.preprocess((v) => (v === "" ? undefined : v), z.string().min(20).optional());

/** 서버에서만 읽는 값. 비밀값 이름에 NEXT_PUBLIC_ 이 붙으면 거부한다. */
export const serverSchema = z
  .object({
    DATA_BACKEND: z.enum(["memory", "supabase"]).default("memory"),
    SUPABASE_SERVICE_ROLE_KEY: optional,
    ANTHROPIC_API_KEY: optional, // 없으면 오프라인 키워드 채점으로 동작
    CLAUDE_MODEL: z.preprocess((v) => (v === "" ? undefined : v), z.string().default("claude-opus-5-5")),
    STUDENT_SESSION_SECRET: z.string().min(32, "STUDENT_SESSION_SECRET 은 32자 이상이어야 합니다."),
    // memory 모드에서 교사 로그인에 쓰는 코드. 비워 두면 교사 화면을 쓸 수 없다.
    TEACHER_PASSCODE: z.preprocess((v) => (v === "" ? undefined : v), z.string().min(8, "TEACHER_PASSCODE 는 8자 이상이어야 합니다.").optional()),
  })
  .refine((e) => e.DATA_BACKEND !== "supabase" || !!e.SUPABASE_SERVICE_ROLE_KEY, {
    message: "DATA_BACKEND=supabase 이면 SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.",
    path: ["SUPABASE_SERVICE_ROLE_KEY"],
  });

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const leaked = Object.keys(source).filter(
    (k) => k.startsWith("NEXT_PUBLIC_") && /SERVICE_ROLE|ANTHROPIC|SECRET|PRIVATE/i.test(k),
  );
  if (leaked.length > 0) {
    throw new Error(`비밀값이 NEXT_PUBLIC_ 으로 노출되도록 설정되어 있습니다: ${leaked.join(", ")}`);
  }
  return serverSchema.parse(source);
}

let cached: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}

/** 테스트에서 환경변수를 바꾼 뒤 다시 읽게 할 때 사용 */
export function resetServerEnvCache() {
  cached = null;
}
