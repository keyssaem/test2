import "server-only";
import { serverEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createMemoryRepo } from "./memory-repo";
import type { GameRepo } from "./repo";
import { createSupabaseRepo } from "./supabase-repo";

// 개발 서버의 핫 리로드에도 메모리 저장소가 유지되도록 globalThis 에 보관
const g = globalThis as unknown as { __pqRepo?: GameRepo };

export function getRepo(): GameRepo {
  if (g.__pqRepo) return g.__pqRepo;
  const env = serverEnv();
  if (env.DATA_BACKEND === "supabase") {
    g.__pqRepo = createSupabaseRepo(createSupabaseAdminClient());
  } else {
    if (process.env.NODE_ENV === "production") {
      console.warn("[prompt-quest] 메모리 저장소로 실행 중입니다. 서버를 다시 시작하면 기록이 사라집니다.");
    }
    g.__pqRepo = createMemoryRepo();
  }
  return g.__pqRepo;
}

/** 테스트용: 저장소를 교체한다. */
export function setRepoForTesting(repo: GameRepo | undefined) {
  g.__pqRepo = repo;
}
