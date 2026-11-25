import { NextResponse, type NextRequest } from "next/server";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/game/http";
import { createClassWithCode } from "@/lib/teacher/dashboard";
import { requireTeacher } from "@/lib/teacher/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { teacher, repo } = await requireTeacher(req);
    return NextResponse.json({ classes: await repo.listClasses(teacher.id) }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    const { teacher, repo } = await requireTeacher(req);
    const cls = await createClassWithCode(repo, teacher.id, await readJson(req));
    return NextResponse.json({ class: cls }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
