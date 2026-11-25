import "server-only";
import { timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { LOCAL_TEACHER_ID } from "@/lib/data/memory-repo";
import { serverEnv } from "@/lib/server-env";
import { verifyTeacherToken } from "@/lib/student-session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const TEACHER_COOKIE = "pq_teacher";

export type Teacher = { id: string; label: string };

/** 교사 코드 비교 (길이·내용이 달라도 같은 시간이 걸리도록 해시 후 비교) */
export function passcodeMatches(given: string, expected: string): boolean {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

function fromToken(token: string | undefined): Teacher | null {
  const s = verifyTeacherToken(token, serverEnv().STUDENT_SESSION_SECRET);
  return s ? { id: s.teacherId, label: "선생님" } : null;
}

/** 라우트 핸들러용 */
export async function getTeacherFromRequest(req: NextRequest): Promise<Teacher | null> {
  if (serverEnv().DATA_BACKEND === "supabase") return getSupabaseTeacher();
  return fromToken(req.cookies.get(TEACHER_COOKIE)?.value);
}

/** 서버 컴포넌트(페이지)용 */
export async function getTeacher(): Promise<Teacher | null> {
  if (serverEnv().DATA_BACKEND === "supabase") return getSupabaseTeacher();
  return fromToken((await cookies()).get(TEACHER_COOKIE)?.value);
}

async function getSupabaseTeacher(): Promise<Teacher | null> {
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getUser(); // 서버에서 토큰을 검증하는 getUser 사용
  return data.user ? { id: data.user.id, label: data.user.email ?? "선생님" } : null;
}

export { LOCAL_TEACHER_ID };
