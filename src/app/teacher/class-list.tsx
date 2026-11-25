"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ClassInfo } from "@/lib/game/types";

export default function ClassList({ initial, teacherLabel }: { initial: ClassInfo[]; teacherLabel: string }) {
  const router = useRouter();
  const [classes, setClasses] = useState(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "만들지 못했어요.");
      setClasses((c) => [...c, data.class]);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "만들지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/teacher/logout", { method: "POST" });
    router.replace("/teacher/login");
  }

  return (
    <main className="min-h-screen max-w-5xl mx-auto px-4 py-8 space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="title-shadow text-3xl font-bold text-orange">내 학급</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-violet-soft">{teacherLabel}</span>
          <button onClick={logout} className="underline">
            로그아웃
          </button>
        </div>
      </header>

      <form onSubmit={create} className="pixel-box p-4 flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-48 space-y-1">
          <span className="text-sm font-bold">새 학급 이름</span>
          <input
            className="pixel-input w-full"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            placeholder="예) 26 프롬프트 6-6"
            required
          />
        </label>
        <button className="pixel-btn" disabled={busy}>
          + 학급 만들기
        </button>
        {error && <p className="w-full text-rose font-bold text-sm">{error}</p>}
      </form>

      {classes.length === 0 ? (
        <p className="text-center text-violet-soft">아직 학급이 없어요. 위에서 만들어 보세요.</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <li key={c.id}>
              <Link href={`/teacher/classes/${c.id}`} className="pixel-box block p-5 space-y-3 hover:-translate-y-0.5 transition-transform">
                <p className="font-bold text-lg truncate">{c.name}</p>
                <p className="text-sm">
                  학급 코드 <span className="font-bold tracking-[0.25em] text-violet">{c.joinCode}</span>
                </p>
                <p className="text-sm font-bold text-orange-deep">{c.isPaused ? "⏸ 일시정지 중" : "▶ 대시보드 열기"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
