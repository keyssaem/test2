import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, errorResponse, STUDENT_COOKIE } from "@/lib/game/http";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(STUDENT_COOKIE);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
