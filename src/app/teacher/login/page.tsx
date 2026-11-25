import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/server-env";
import { getTeacher } from "@/lib/teacher/auth";
import TeacherLoginForm from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "프롬프트 퀘스트 · 교사 로그인" };

export default async function TeacherLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getTeacher()) redirect("/teacher");
  const env = serverEnv();
  const { error } = await searchParams;
  const mode = env.DATA_BACKEND === "supabase" ? "email" : env.TEACHER_PASSCODE ? "passcode" : "disabled";

  return (
    <main className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
      <h1 className="title-shadow text-4xl font-bold text-orange">교사 대시보드</h1>
      {mode === "disabled" ? (
        <p className="pixel-box p-6 max-w-sm">
          교사 로그인이 꺼져 있습니다. <code>.env.local</code> 에 <code>TEACHER_PASSCODE</code> 를 설정하세요.
        </p>
      ) : (
        <TeacherLoginForm mode={mode} linkError={error === "link"} />
      )}
    </main>
  );
}
