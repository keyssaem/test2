import { notFound, redirect } from "next/navigation";
import { getTeacherRepo } from "@/lib/data";
import { serverEnv } from "@/lib/server-env";
import { getTeacher } from "@/lib/teacher/auth";
import Dashboard from "./dashboard";

export const dynamic = "force-dynamic";
export const metadata = { title: "프롬프트 퀘스트 · 대시보드" };

export default async function ClassDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");
  const { id } = await params;
  const cls = await (await getTeacherRepo()).getOwnedClass(teacher.id, id);
  if (!cls) notFound();
  return <Dashboard classId={cls.id} live={serverEnv().DATA_BACKEND === "supabase" ? "supabase" : "sse"} />;
}
