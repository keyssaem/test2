import { z } from "zod";

/**
 * 브라우저에 노출되어도 되는 값만 여기 둔다.
 * Next.js는 NEXT_PUBLIC_ 로 시작하는 값만 클라이언트 번들에 넣는다.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
});

export type PublicEnv = z.infer<typeof publicSchema>;

export function parsePublicEnv(source: Record<string, string | undefined>): PublicEnv {
  return publicSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: source.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: source.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}

export function publicEnv(): PublicEnv {
  // 정적 치환을 위해 process.env.X 를 직접 참조해야 한다.
  return parsePublicEnv({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
