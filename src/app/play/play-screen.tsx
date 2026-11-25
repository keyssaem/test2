"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { AttemptResult, StudentView } from "@/lib/game/service";

const MAX = 100;

const OUTCOME_TEXT: Record<AttemptResult["outcome"], string> = {
  retry: "아깝다! 다시 도전해 볼까요?",
  "image-passed": "통과! 다음 그림으로 가요.",
  "image-failed": "기회를 다 썼어요. 모범 설명을 보고 다음 그림에 도전!",
  "level-up": "LEVEL UP!",
  "level-retry": "이번 레벨을 한 번 더 연습해 봐요!",
  done: "모든 레벨 완료!",
  blocked: "잠깐!",
};

export default function PlayScreen() {
  const router = useRouter();
  const [view, setView] = useState<StudentView | null>(null);
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/student/state", { cache: "no-store" });
    if (res.status === 401) {
      router.replace("/");
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "불러오지 못했어요.");
      return;
    }
    setView(data);
  }, [router]);

  useEffect(() => {
    // 마운트 시 최초 상태를 불러온다 (외부 API 동기화)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // 선생님이 일시정지했을 때 풀렸는지 주기적으로 확인
  useEffect(() => {
    if (!view?.isPaused) return;
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [view?.isPaused, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/student/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (res.status === 401) return router.replace("/");
      if (!res.ok) throw new Error(data.error ?? "제출하지 못했어요.");
      setResult(data as AttemptResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "제출하지 못했어요.");
    } finally {
      setBusy(false);
    }
  }

  function continueGame() {
    if (!result) return;
    const finishedImage = result.reference !== null;
    setView(result.view);
    setResult(null);
    if (finishedImage) setPrompt("");
  }

  async function logout() {
    await fetch("/api/student/logout", { method: "POST" });
    router.replace("/");
  }

  if (!view) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="blink text-xl">{error ?? "불러오는 중…"}</p>
      </main>
    );
  }

  // 결과를 보여주는 동안에는 '제출 당시' 화면을 유지한다
  const shown = view;
  const level = shown.level;
  const done = shown.status === "done";

  return (
    <main className="min-h-screen px-4 py-4 sm:px-8 max-w-6xl mx-auto flex flex-col gap-4">
      {/* 상단 바 */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="pixel-box px-3 py-1 font-bold">LV {level.id}</span>
          <div>
            <p className="font-bold text-orange text-lg">{level.title}</p>
            <p className="text-xs text-violet-soft">{shown.className}</p>
          </div>
        </div>
        <LevelTrack current={level.id} total={shown.totalLevels} done={done} />
        <div className="flex items-center gap-3 text-sm">
          <span>
            {shown.student.number}번 {shown.student.nickname}
          </span>
          <span className="text-orange" aria-label={`통과한 그림 ${shown.passedCount}개`}>
            ★ {shown.passedCount}
          </span>
          <button onClick={logout} className="underline text-violet-soft">
            나가기
          </button>
        </div>
      </header>

      {done ? (
        <DoneCard passed={shown.passedCount} />
      ) : (
        <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
          {/* 목표 그림 */}
          <section className="pixel-box p-3 space-y-3">
            <div className="flex justify-between text-sm font-bold">
              <span>
                그림 {shown.image.index + 1} / {level.imageCount}
              </span>
              <span>
                통과 {shown.levelPassed} / 필요 {level.needToPass}
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={shown.image.src}
              alt={shown.image.alt}
              className="w-full aspect-[4/3] object-cover border-4 border-ink bg-white"
              style={{ imageRendering: shown.image.id.includes("pixel") ? "pixelated" : "auto" }}
            />
            <div>
              <p className="text-sm font-bold mb-1">💡 이렇게 말해 봐요</p>
              <ul className="text-sm grid grid-cols-1 sm:grid-cols-2 gap-1">
                {level.checklist.map((c) => (
                  <li key={c}>☐ {c}</li>
                ))}
              </ul>
            </div>
          </section>

          {/* 입력 / 결과 */}
          <section className="flex flex-col gap-4">
            <div className="pixel-box p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold">{level.description}</p>
                <Hearts left={shown.attemptsLeft} max={level.maxAttempts} />
              </div>
              <form onSubmit={submit} className="space-y-3">
                <label className="sr-only" htmlFor="prompt">
                  그림 설명
                </label>
                <textarea
                  id="prompt"
                  className="pixel-input w-full h-28 resize-none text-lg leading-relaxed"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value.slice(0, MAX))}
                  placeholder="그림에 보이는 것을 한국어로 설명해 보세요."
                  disabled={busy || !!result || shown.isPaused}
                />
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${prompt.length >= MAX ? "text-rose font-bold" : ""}`}>
                    {prompt.length} / {MAX}자
                  </span>
                  <button className="pixel-btn" disabled={busy || !!result || shown.isPaused || prompt.trim().length < 2}>
                    {busy ? "채점 중…" : "제출하기"}
                  </button>
                </div>
              </form>
              {error && (
                <p role="alert" className="text-rose font-bold text-sm">
                  {error}
                </p>
              )}
              <p className="text-xs text-ink/60">통과 기준: {level.passThreshold}점 이상</p>
            </div>

            {result && <ResultCard result={result} threshold={level.passThreshold} onContinue={continueGame} />}

            {!result && shown.history.length > 0 && (
              <div className="pixel-box p-4">
                <p className="font-bold text-sm mb-2">이 그림에서 쓴 설명</p>
                <ol className="space-y-1 text-sm">
                  {shown.history.map((h, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">“{h.prompt}”</span>
                      <span className={h.passed ? "text-mint font-bold" : ""}>{h.score}점</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        </div>
      )}

      {shown.isPaused && (
        <div className="fixed inset-0 bg-night/80 grid place-items-center z-20" role="dialog" aria-live="polite">
          <div className="pixel-box p-8 text-center space-y-2 pop">
            <p className="text-3xl">⏸</p>
            <p className="font-bold text-xl">선생님이 잠시 멈췄어요</p>
            <p className="text-sm">화면을 보고 기다려 주세요!</p>
          </div>
        </div>
      )}
    </main>
  );
}

function LevelTrack({ current, total, done }: { current: number; total: number; done: boolean }) {
  return (
    <ol className="flex gap-1" aria-label={`레벨 ${current} / ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const state = done || n < current ? "clear" : n === current ? "now" : "lock";
        return (
          <li
            key={n}
            className={`w-8 h-8 grid place-items-center text-xs font-bold border-4 border-ink ${
              state === "clear" ? "bg-orange text-ink" : state === "now" ? "bg-cream text-ink" : "bg-night-2 text-violet-soft"
            }`}
          >
            {state === "lock" ? "🔒" : n}
          </li>
        );
      })}
    </ol>
  );
}

function Hearts({ left, max }: { left: number; max: number }) {
  return (
    <span aria-label={`남은 기회 ${left}번`} className="text-xl tracking-wider">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={i < left ? "text-rose" : "text-ink/20"}>
          ♥
        </span>
      ))}
    </span>
  );
}

function ResultCard({ result, threshold, onContinue }: { result: AttemptResult; threshold: number; onContinue: () => void }) {
  const big = result.outcome === "level-up" || result.outcome === "done";
  return (
    <div className={`pixel-box p-4 space-y-3 pop ${result.passed ? "bg-[#eafff4]" : ""}`} role="status" aria-live="polite">
      <p className={`font-bold ${big ? "text-3xl text-orange-deep text-center" : "text-lg"}`}>{OUTCOME_TEXT[result.outcome]}</p>

      {result.outcome !== "blocked" && (
        <div>
          <div className="flex justify-between text-sm font-bold mb-1">
            <span>점수</span>
            <span>{result.score}점</span>
          </div>
          <div className="relative h-6 border-4 border-ink bg-white">
            <div
              className={`h-full ${result.passed ? "bg-mint" : "bg-orange"}`}
              style={{ width: `${result.score}%` }}
            />
            <div className="absolute top-0 bottom-0 w-1 bg-ink" style={{ left: `${threshold}%` }} title="통과 기준" />
          </div>
        </div>
      )}

      {(result.matchedLabels.length > 0 || result.missingLabels.length > 0) && (
        <div className="flex flex-wrap gap-2 text-sm">
          {result.matchedLabels.map((l) => (
            <span key={`m-${l}`} className="px-2 py-0.5 bg-mint text-ink border-2 border-ink">
              ✔ {l}
            </span>
          ))}
          {result.missingLabels.map((l) => (
            <span key={`x-${l}`} className="px-2 py-0.5 bg-white text-ink/70 border-2 border-dashed border-ink/50">
              ? {l}
            </span>
          ))}
        </div>
      )}

      {result.tips.length > 0 && (
        <ul className="text-sm space-y-1">
          {result.tips.map((t) => (
            <li key={t}>💬 {t}</li>
          ))}
        </ul>
      )}

      {result.reference && (
        <p className="text-sm bg-violet-soft/40 p-2 border-2 border-ink">
          <b>모범 설명:</b> {result.reference}
        </p>
      )}

      <button className="pixel-btn w-full" onClick={onContinue} autoFocus>
        {result.reference ? "다음으로 ▶" : "다시 쓰기"}
      </button>
    </div>
  );
}

function DoneCard({ passed }: { passed: number }) {
  return (
    <section className="pixel-box p-10 text-center space-y-4 pop max-w-xl mx-auto">
      <p className="text-5xl">🏆</p>
      <h2 className="text-3xl font-bold text-orange-deep">퀘스트 완료!</h2>
      <p>모든 레벨을 끝냈어요. 통과한 그림 ★ {passed}개</p>
      <p className="text-sm">이제 보이는 것을 말로 잘 설명하는 프롬프트 고수예요!</p>
    </section>
  );
}
