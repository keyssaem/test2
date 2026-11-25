import { redirect } from "next/navigation";
import { getTeacherRepo } from "@/lib/data";
import { getTeacher } from "@/lib/teacher/auth";
import ClassList from "./class-list";

export const dynamic = "force-dynamic";
export const metadata = { title: "프롬프트 퀘스트 · 내 학급" };

export default async function TeacherHome() {
  const teacher = await getTeacher();
  if (!teacher) redirect("/teacher/login");
  const classes = await (await getTeacherRepo()).listClasses(teacher.id);
  return <ClassList initial={classes} teacherLabel={teacher.label} />;
}
