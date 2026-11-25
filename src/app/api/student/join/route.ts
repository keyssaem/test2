import { NextResponse, type NextRequest } from "next/server";
import { getRepo } from "@/lib/data";
import { assertSameOrigin, cookieOptions, errorResponse, readJson, STUDENT_COOKIE } from "@/lib/game/http";
import { joinLimiter } from "@/lib/game/rate-limit";
import { GameError, joinClass } from "@/lib/game/service";
import { serverEnv } from "@/lib/server-env";
import { createStudentToken } from "@/lib/student-session";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    if (!joinLimiter.check(`join:${ip}`)) throw new GameError("RATE_LIMITED", "잠시 후 다시 시도해 주세요.", 429);

    const { student, cls } = await joinClass(getRepo(), await readJson(req));
    const token = createStudentToken({ studentId: student.id, classId: cls.id }, serverEnv().STUDENT_SESSION_SECRET);

    const res = NextResponse.json({ ok: true, className: cls.name, nickname: student.nickname });
    res.cookies.set(STUDENT_COOKIE, token, cookieOptions());
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
