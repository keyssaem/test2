import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { assertSameOrigin, errorResponse, readJson } from "@/lib/game/http";
import { GameError } from "@/lib/game/service";
import { buildSnapshot } from "@/lib/teacher/dashboard";
import { notFound, requireTeacher } from "@/lib/teacher/http";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** 대시보드 스냅샷 */
export async function GET(req: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const { teacher, repo } = await requireTeacher(req);
    const data = await repo.loadClassData(teacher.id, id);
    if (!data) notFound();
    return NextResponse.json(buildSnapshot(data), { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}

const Patch = z.object({ isPaused: z.boolean() });

/** 일시정지 / 재개 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const { teacher, repo } = await requireTeacher(req);
    const parsed = Patch.safeParse(await readJson(req));
    if (!parsed.success) throw new GameError("BAD_INPUT", "잘못된 요청입니다.");
    const cls = await repo.setPaused(teacher.id, id, parsed.data.isPaused);
    if (!cls) notFound();
    return NextResponse.json({ class: cls });
  } catch (err) {
    return errorResponse(err);
  }
}

/** 학급과 모든 학생 기록 삭제 (학기 말 정리) */
export async function DELETE(req: NextRequest, ctx: Ctx) {
  try {
    assertSameOrigin(req);
    const { id } = await ctx.params;
    const { teacher, repo } = await requireTeacher(req);
    if (!(await repo.deleteClass(teacher.id, id))) notFound();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
