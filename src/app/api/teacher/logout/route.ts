import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, errorResponse } from "@/lib/game/http";
import { serverEnv } from "@/lib/server-env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TEACHER_COOKIE } from "@/lib/teacher/auth";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    if (serverEnv().DATA_BACKEND === "supabase") await (await createSupabaseServerClient()).auth.signOut();
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(TEACHER_COOKIE);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
