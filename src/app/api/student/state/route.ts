import { NextResponse, type NextRequest } from "next/server";
import { getRepo } from "@/lib/data";
import { errorResponse, readSession } from "@/lib/game/http";
import { getStudentView } from "@/lib/game/service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const view = await getStudentView(getRepo(), readSession(req));
    return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
