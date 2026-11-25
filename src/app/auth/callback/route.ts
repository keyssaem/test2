import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** supabase 모드: 이메일 로그인 링크를 누르면 이곳으로 돌아와 세션을 만든다. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const db = await createSupabaseServerClient();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/teacher", req.nextUrl.origin));
  }
  return NextResponse.redirect(new URL("/teacher/login?error=link", req.nextUrl.origin));
}
