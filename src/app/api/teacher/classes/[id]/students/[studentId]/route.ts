import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/game/http";
import { buildStudentDetail } from "@/lib/teacher/dashboard";
import { notFound, requireTeacher } from "@/lib/teacher/http";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string; studentId: string }> }) {
  try {
    const { id, studentId } = await ctx.params;
    const { teacher, repo } = await requireTeacher(req);
    const data = await repo.loadClassData(teacher.id, id);
    const detail = data && buildStudentDetail(data, studentId);
    if (!detail) notFound();
    return NextResponse.json(detail, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
