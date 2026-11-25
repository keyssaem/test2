import "server-only"; // 클라이언트 컴포넌트에서 import하면 빌드가 실패한다.
import { z } from "zod";

/** 서버에서만 읽는 비밀값. 이름에 NEXT_PUBLIC_ 이 붙으면 거부한다. */
export const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  ANTHROPIC_API_KEY: z.string().min(20),
  STUDENT_SESSION_SECRET: z
    .string()
    .min(32, "STUDENT_SESSION_SECRET 은 32자 이상이어야 합니다."),
});

export type ServerEnv = z.infer<typeof serverSchema>;

export function parseServerEnv(source: Record<string, string | undefined>): ServerEnv {
  const leaked = Object.keys(source).filter(
    (k) =>
      k.startsWith("NEXT_PUBLIC_") &&
      /SERVICE_ROLE|ANTHROPIC|SECRET|PRIVATE/i.test(k),
  );
  if (leaked.length > 0) {
    throw new Error(
      `비밀값이 NEXT_PUBLIC_ 으로 노출되도록 설정되어 있습니다: ${leaked.join(", ")}`,
    );
  }
  return serverSchema.parse(source);
}

let cached: ServerEnv | null = null;
export function serverEnv(): ServerEnv {
  cached ??= parseServerEnv(process.env);
  return cached;
}
