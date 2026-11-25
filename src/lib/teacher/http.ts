import "server-only";
import type { NextRequest } from "next/server";
import { getTeacherRepo } from "@/lib/data";
import { GameError } from "@/lib/game/service";
import { getTeacherFromRequest } from "./auth";

/** 교사 API 공통: 로그인 확인 + 교사 저장소 */
export async function requireTeacher(req: NextRequest) {
  const teacher = await getTeacherFromRequest(req);
  if (!teacher) throw new GameError("NO_SESSION", "교사 로그인이 필요합니다.", 401);
  return { teacher, repo: await getTeacherRepo() };
}

/** 남의 학급이거나 없는 학급이면 똑같이 404 (존재 여부를 알려주지 않음) */
export function notFound(): never {
  throw new GameError("CLASS_NOT_FOUND", "학급을 찾을 수 없습니다.", 404);
}
