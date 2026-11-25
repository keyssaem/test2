import { NextResponse, type NextRequest } from "next/server";
import { getRepo } from "@/lib/data";
import { assertSameOrigin, errorResponse, readJson, readSession } from "@/lib/game/http";
import { attemptLimiter } from "@/lib/game/rate-limit";
import { getScorer } from "@/lib/game/scorer";
import { GameError, submitAttempt } from "@/lib/game/service";

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const session = readSession(req);
    if (session && !attemptLimiter.check(`attempt:${session.studentId}`)) {
      throw new GameError("RATE_LIMITED", "천천히! 잠깐 쉬었다가 다시 제출해요.", 429);
    }
    const result = await submitAttempt(getRepo(), getScorer(), session, await readJson(req));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
