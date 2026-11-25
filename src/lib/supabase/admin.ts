import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/server-env";

/**
 * service_role 키는 RLS를 우회한다. 서버 라우트에서만, 학생 세션을 검증한 뒤 사용한다.
 * 학생은 Supabase 계정이 없으므로(개인정보 최소화) 학생 쓰기 요청은 모두 이 경로를 거친다.
 */
export function createSupabaseAdminClient() {
  const key = serverEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY 가 설정되지 않았습니다.");
  return createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
