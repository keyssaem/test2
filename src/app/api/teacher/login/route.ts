import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, cookieOptions, errorResponse, readJson } from "@/lib/game/http";
import { teacherLoginLimiter } from "@/lib/game/rate-limit";
import { GameError } from "@/lib/game/service";
import { serverEnv } from "@/lib/server-env";
import { createTeacherToken } from "@/lib/student-session";
import { LOCAL_TEACHER_ID, passcodeMatches, TEACHER_COOKIE } from "@/lib/teacher/auth";

const Body = z.object({ passcode: z.string().max(200) });

/** memory 모드 전용 교사 로그인 (supabase 모드는 이메일 로그인 사용) */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const env = serverEnv();
    if (env.DATA_BACKEND !== "memory" || !env.TEACHER_PASSCODE) {
      throw new GameError("BAD_INPUT", "이 방식의 교사 로그인은 사용할 수 없습니다.", 404);
    }
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
    if (!teacherLoginLimiter.check(`tlogin:${ip}`)) throw new GameError("RATE_LIMITED", "잠시 후 다시 시도해 주세요.", 429);

    const parsed = Body.safeParse(await readJson(req));
    if (!parsed.success || !passcodeMatches(parsed.data.passcode, env.TEACHER_PASSCODE)) {
      throw new GameError("BAD_INPUT", "교사 코드가 맞지 않습니다.", 401);
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(TEACHER_COOKIE, createTeacherToken(LOCAL_TEACHER_ID, env.STUDENT_SESSION_SECRET), {
      ...cookieOptions(),
      maxAge: 60 * 60 * 12,
    });
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
