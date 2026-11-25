"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [number, setNumber] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/student/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim(), number: Number(number), nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "입장하지 못했어요.");
      router.push("/play");
    } catch (err) {
      setError(err instanceof Error ? err.message : "입장하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="pixel-box w-full max-w-sm p-6 space-y-4" aria-label="학급 입장">
      <h2 className="text-xl font-bold text-center">▶ 학급 입장</h2>

      <label className="block space-y-1">
        <span className="text-sm font-bold">학급 코드</span>
        <input
          className="pixel-input w-full uppercase tracking-[0.3em]"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="DEMO01"
          autoComplete="off"
          required
        />
      </label>

      <div className="flex gap-3">
        <label className="block space-y-1 w-24">
          <span className="text-sm font-bold">번호</span>
          <input
            className="pixel-input w-full"
            type="number"
            inputMode="numeric"
            min={1}
            max={60}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            required
          />
        </label>
        <label className="block space-y-1 flex-1">
          <span className="text-sm font-bold">별명</span>
          <input
            className="pixel-input w-full"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={12}
            placeholder="예) 반짝별"
            autoComplete="off"
            required
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="text-sm font-bold text-rose">
          {error}
        </p>
      )}

      <button className="pixel-btn w-full" disabled={busy}>
        {busy ? "입장하는 중…" : "게임 시작!"}
      </button>
    </form>
  );
}
