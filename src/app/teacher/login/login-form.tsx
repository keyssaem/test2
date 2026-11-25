"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function TeacherLoginForm({ mode, linkError }: { mode: "passcode" | "email"; linkError: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(
    linkError ? { ok: false, text: "로그인 링크가 만료되었거나 잘못되었어요. 다시 요청해 주세요." } : null,
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (mode === "passcode") {
        const res = await fetch("/api/teacher/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ passcode: value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "로그인하지 못했어요.");
        router.replace("/teacher");
        return;
      }
      const { error } = await createSupabaseBrowserClient().auth.signInWithOtp({
        email: value.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw new Error("로그인 메일을 보내지 못했어요.");
      setMsg({ ok: true, text: "메일함에서 로그인 링크를 눌러 주세요." });
    } catch (err) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : "로그인하지 못했어요." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="pixel-box w-full max-w-sm p-6 space-y-4">
      <h2 className="text-xl font-bold text-center">🔑 선생님 로그인</h2>
      <label className="block space-y-1">
        <span className="text-sm font-bold">{mode === "passcode" ? "교사 코드" : "학교 이메일"}</span>
        <input
          className="pixel-input w-full"
          type={mode === "passcode" ? "password" : "email"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete={mode === "passcode" ? "current-password" : "email"}
          required
        />
      </label>
      {mode === "passcode" && <p className="text-xs text-ink/60">교사 코드는 서버의 .env.local 파일(TEACHER_PASSCODE)에 있어요.</p>}
      {msg && (
        <p role="alert" className={`text-sm font-bold ${msg.ok ? "text-[#1d8a5a]" : "text-rose"}`}>
          {msg.text}
        </p>
      )}
      <button className="pixel-btn w-full" disabled={busy}>
        {busy ? "확인 중…" : mode === "passcode" ? "들어가기" : "로그인 링크 받기"}
      </button>
    </form>
  );
}
