import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/server-env";
import { verifyStudentToken, type StudentSession } from "@/lib/student-session";
import { GameError } from "./service";

export const STUDENT_COOKIE = "pq_student";
export const COOKIE_MAX_AGE = 60 * 60 * 6;

export function readSession(req: NextRequest): StudentSession | null {
  return verifyStudentToken(req.cookies.get(STUDENT_COOKIE)?.value, serverEnv().STUDENT_SESSION_SECRET);
}

export function cookieOptions() {
  return {
    httpOnly: true, // JS에서 읽을 수 없음
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** 같은 출처에서 온 요청만 허용 (다른 사이트가 학생 대신 제출하는 것을 막음) */
export function assertSameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (origin && origin !== req.nextUrl.origin) {
    throw new GameError("BAD_INPUT", "허용되지 않은 요청입니다.", 403);
  }
}

export function errorResponse(err: unknown) {
  if (err instanceof GameError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  console.error("[prompt-quest] 처리 중 오류:", err instanceof Error ? err.message : err);
  return NextResponse.json({ error: "잠시 후 다시 시도해 주세요.", code: "SERVER" }, { status: 500 });
}

export async function readJson(req: NextRequest): Promise<unknown> {
  const text = await req.text();
  if (text.length > 2_000) throw new GameError("BAD_INPUT", "요청이 너무 큽니다.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new GameError("BAD_INPUT", "잘못된 요청입니다.");
  }
}
