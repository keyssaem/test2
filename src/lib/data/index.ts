import "server-only";
import { serverEnv } from "@/lib/server-env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createMemoryRepo, type MemoryRepo } from "./memory-repo";
import type { GameRepo, TeacherRepo } from "./repo";
import { createSupabaseRepo } from "./supabase-repo";
import { createSupabaseTeacherRepo } from "./supabase-teacher-repo";

// 개발 서버의 핫 리로드에도 메모리 저장소가 유지되도록 globalThis 에 보관
const g = globalThis as unknown as { __pqRepo?: GameRepo; __pqMemory?: MemoryRepo };

function memory(): MemoryRepo {
  if (!g.__pqMemory) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[prompt-quest] 메모리 저장소로 실행 중입니다. 서버를 다시 시작하면 기록이 사라집니다.");
    }
    g.__pqMemory = createMemoryRepo();
  }
  return g.__pqMemory;
}

/** 학생 쪽 저장소 (supabase 모드: service_role) */
export function getRepo(): GameRepo {
  if (g.__pqRepo) return g.__pqRepo;
  g.__pqRepo = serverEnv().DATA_BACKEND === "supabase" ? createSupabaseRepo(createSupabaseAdminClient()) : memory();
  return g.__pqRepo;
}

/** 교사 쪽 저장소 (supabase 모드: 교사 로그인 세션 + RLS) */
export async function getTeacherRepo(): Promise<TeacherRepo> {
  if (serverEnv().DATA_BACKEND === "supabase") return createSupabaseTeacherRepo(await createSupabaseServerClient());
  return (g.__pqRepo as MemoryRepo | undefined) ?? memory();
}

/** 테스트용: 메모리 저장소를 교체한다. */
export function setRepoForTesting(repo: MemoryRepo | undefined) {
  g.__pqRepo = repo;
  g.__pqMemory = repo;
}
