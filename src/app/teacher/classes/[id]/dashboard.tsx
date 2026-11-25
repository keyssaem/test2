"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { DashboardSnapshot, DashboardStudent } from "@/lib/teacher/dashboard";

type Detail = {
  student: { id: string; number: number; nickname: string };
  attempts: {
    prompt: string;
    score: number;
    passed: boolean;
    flagged: boolean;
    feedback: string;
    at: string;
    imageId: string;
    imageSrc: string | null;
    levelId: number | null;
    reference: string | null;
  }[];
};

type Spotlight = { prompt: string; imageSrc: string | null; who: string; score: number };

type SortKey = "number" | "level" | "recent" | "stuck";
type FilterKey = "all" | "stuck" | "flagged" | "done";

const STORAGE_COLS = "pq.dashboard.cols";

export default function Dashboard({ classId, live }: { classId: string; live: "sse" | "supabase" }) {
  const router = useRouter();
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [cols, setCols] = useState(5);
  const [sort, setSort] = useState<SortKey>("number");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [spotlight, setSpotlight] = useState<Spotlight | null>(null);
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const prevUpdated = useRef<Map<string, string | null>>(new Map());

  const load = useCallback(async () => {
    const res = await fetch(`/api/teacher/classes/${classId}`, { cache: "no-store" });
    if (res.status === 401) return router.replace("/teacher/login");
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "불러오지 못했어요.");
    const s = data as DashboardSnapshot;
    // 방금 바뀐 카드를 잠깐 반짝이게
    const changed = new Set<string>();
    for (const st of s.students) {
      const before = prevUpdated.current.get(st.id);
      if (prevUpdated.current.size > 0 && before !== st.updatedAt) changed.add(st.id);
      prevUpdated.current.set(st.id, st.updatedAt);
    }
    if (changed.size) {
      setFlash(changed);
      setTimeout(() => setFlash(new Set()), 1500);
    }
    setSnap(s);
    setError(null);
  }, [classId, router]);

  // 열 개수는 이 브라우저에만 기억
  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(STORAGE_COLS));
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (v >= 2 && v <= 8) setCols(v);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_COLS, String(cols));
    } catch {}
  }, [cols]);

  // 처음 불러오기 + 실시간 연결 + 안전망 폴링
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    let stop = () => {};
    if (live === "sse") {
      const es = new EventSource(`/api/teacher/classes/${classId}/events`);
      es.addEventListener("ready", () => setConnected(true));
      es.addEventListener("change", () => void load());
      es.onerror = () => setConnected(false);
      stop = () => es.close();
    } else {
      const db = createSupabaseBrowserClient();
      const ch = db
        .channel(`class-${classId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "student_progress", filter: `class_id=eq.${classId}` }, () => void load())
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "attempts", filter: `class_id=eq.${classId}` }, () => void load())
        .subscribe((status) => setConnected(status === "SUBSCRIBED"));
      stop = () => void db.removeChannel(ch);
    }
    const poll = setInterval(load, 20_000);
    return () => {
      stop();
      clearInterval(poll);
    };
  }, [classId, live, load]);

  const students = useMemo(() => {
    if (!snap) return [];
    let list = snap.students;
    if (filter === "stuck") list = list.filter((s) => s.status === "stuck");
    if (filter === "flagged") list = list.filter((s) => s.flaggedCount > 0);
    if (filter === "done") list = list.filter((s) => s.status === "done");
    const by: Record<SortKey, (a: DashboardStudent, b: DashboardStudent) => number> = {
      number: (a, b) => a.number - b.number,
      level: (a, b) => (b.status === "done" ? 99 : b.levelId) - (a.status === "done" ? 99 : a.levelId) || b.passedCount - a.passedCount,
      recent: (a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""),
      stuck: (a, b) => Number(b.status === "stuck") - Number(a.status === "stuck") || b.flaggedCount - a.flaggedCount || a.number - b.number,
    };
    return [...list].sort(by[sort]);
  }, [snap, filter, sort]);

  async function togglePause() {
    if (!snap) return;
    const res = await fetch(`/api/teacher/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPaused: !snap.class.isPaused }),
    });
    if (res.ok) void load();
  }

  async function deleteClass() {
    if (!snap) return;
    const typed = window.prompt(`학급과 모든 학생 기록이 영구 삭제됩니다. 되돌릴 수 없어요.\n삭제하려면 학급 코드(${snap.class.joinCode})를 입력하세요.`);
    if (typed?.trim().toUpperCase() !== snap.class.joinCode) return;
    const res = await fetch(`/api/teacher/classes/${classId}`, { method: "DELETE" });
    if (res.ok) router.replace("/teacher");
  }

  if (!snap) {
    return (
      <main className="min-h-screen grid place-items-center">
        <p className="blink text-xl">{error ?? "불러오는 중…"}</p>
      </main>
    );
  }

  const { summary } = snap;
  const donePct = summary.students ? Math.round((summary.done / summary.students) * 100) : 0;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 space-y-4">
      {/* 상단 */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-violet-soft">
            <Link href="/teacher" className="underline">
              내 학급
            </Link>{" "}
            › 대시보드
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold">{snap.class.name}</h1>
          <div className="flex items-center gap-3 text-xs">
            <span className={`inline-flex items-center gap-1 ${connected ? "text-mint" : "text-rose"}`}>
              <span className={`w-2 h-2 inline-block ${connected ? "bg-mint" : "bg-rose blink"}`} />
              {connected ? "실시간 연결됨" : "연결 중…"}
            </span>
            <span className="text-violet-soft">제출 {summary.attempts}회</span>
          </div>
        </div>

        <div className="pixel-box px-4 py-2 text-center">
          <p className="text-xs font-bold">학급 코드</p>
          <p className="text-3xl font-bold tracking-[0.3em] text-violet">{snap.class.joinCode}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={togglePause} className={`pixel-btn ${snap.class.isPaused ? "" : "secondary"}`}>
            {snap.class.isPaused ? "▶ 다시 시작" : "⏸ 모두 멈춤"}
          </button>
          <button onClick={deleteClass} className="text-xs underline text-violet-soft">
            학급 삭제
          </button>
        </div>
      </header>

      {/* 진행 요약 */}
      <section className="pixel-box p-4 grid gap-4 md:grid-cols-[1.3fr_2fr] items-center">
        <div>
          <div className="flex justify-between text-sm font-bold">
            <span className="text-orange-deep">
              완료: {summary.done}/{summary.students}
            </span>
            <span>참여 {summary.students}명</span>
          </div>
          <div className="h-3 mt-1 bg-ink/15">
            <div className="h-full bg-orange transition-all" style={{ width: `${donePct}%` }} />
          </div>
          <div className="flex gap-2 mt-3 text-xs font-bold">
            <button onClick={() => setFilter(filter === "stuck" ? "all" : "stuck")} className={`px-2 py-1 border-2 border-ink ${filter === "stuck" ? "bg-orange" : "bg-white"}`}>
              ⚠ 막힘 {summary.stuck}
            </button>
            <button onClick={() => setFilter(filter === "flagged" ? "all" : "flagged")} className={`px-2 py-1 border-2 border-ink ${filter === "flagged" ? "bg-orange" : "bg-white"}`}>
              🚩 확인 필요 {summary.flagged}
            </button>
            <button onClick={() => setFilter(filter === "done" ? "all" : "done")} className={`px-2 py-1 border-2 border-ink ${filter === "done" ? "bg-orange" : "bg-white"}`}>
              ✔ 완료 {summary.done}
            </button>
          </div>
        </div>
        <LevelBars counts={summary.levelCounts} done={summary.done} total={summary.students} />
      </section>

      {/* 도구 막대 */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2">
          <label htmlFor="sort">정렬</label>
          <select id="sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="pixel-input py-1">
            <option value="number">번호순</option>
            <option value="level">레벨 높은 순</option>
            <option value="recent">최근 활동순</option>
            <option value="stuck">도움 필요 먼저</option>
          </select>
          {filter !== "all" && (
            <button className="underline text-violet-soft" onClick={() => setFilter("all")}>
              필터 해제
            </button>
          )}
        </div>
        <div className="flex items-center gap-2" aria-label="한 줄 카드 수">
          <span>한 줄에</span>
          <button className="pixel-btn secondary px-3 py-1" onClick={() => setCols((c) => Math.max(2, c - 1))} aria-label="카드 크게">
            −
          </button>
          <span className="w-5 text-center font-bold">{cols}</span>
          <button className="pixel-btn secondary px-3 py-1" onClick={() => setCols((c) => Math.min(8, c + 1))} aria-label="카드 작게">
            +
          </button>
        </div>
      </div>

      {/* 학생 카드 */}
      {students.length === 0 ? (
        <p className="text-center text-violet-soft py-16">
          {summary.students === 0 ? `학생들이 학급 코드 ${snap.class.joinCode} 로 들어오면 여기에 카드가 생겨요.` : "조건에 맞는 학생이 없어요."}
        </p>
      ) : (
        <ul className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {students.map((s) => (
            <StudentCard key={s.id} s={s} flash={flash.has(s.id)} compact={cols >= 7} onOpen={() => setSelected(s.id)} />
          ))}
        </ul>
      )}

      {selected && (
        <DetailPanel
          classId={classId}
          studentId={selected}
          version={snap.students.find((x) => x.id === selected)?.updatedAt ?? ""}
          onClose={() => setSelected(null)}
          onSpotlight={setSpotlight}
        />
      )}
      {spotlight && <SpotlightView s={spotlight} onClose={() => setSpotlight(null)} />}
    </main>
  );
}

function StatusIcon({ s }: { s: DashboardStudent }) {
  const map = {
    done: { icon: "✔", label: "완료", cls: "bg-mint" },
    stuck: { icon: "⚠", label: "막힘", cls: "bg-orange" },
    playing: { icon: "⏱", label: "진행 중", cls: "bg-white" },
  } as const;
  const m = map[s.status];
  return (
    <span title={m.label} aria-label={m.label} className={`w-7 h-7 grid place-items-center border-2 border-ink text-sm ${m.cls}`}>
      {m.icon}
    </span>
  );
}

function StudentCard({ s, flash, compact, onOpen }: { s: DashboardStudent; flash: boolean; compact: boolean; onOpen: () => void }) {
  return (
    <li className={`pixel-box overflow-hidden flex flex-col transition-shadow ${flash ? "ring-4 ring-orange" : ""}`}>
      <button onClick={onOpen} className="text-left flex flex-col flex-1" aria-label={`${s.number}번 ${s.nickname} 자세히 보기`}>
        <div className="relative bg-white border-b-4 border-ink aspect-[4/3]">
          {s.imageSrc && s.status !== "done" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.imageSrc} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full grid place-items-center text-4xl bg-cream">🏆</div>
          )}
          <div className="absolute top-2 left-2 flex gap-1">
            <StatusIcon s={s} />
            {s.flaggedCount > 0 && (
              <span title="확인 필요한 입력" className="w-7 h-7 grid place-items-center border-2 border-ink bg-rose text-sm">
                🚩
              </span>
            )}
          </div>
          <span className="absolute top-2 right-2 bg-ink text-cream text-xs font-bold px-2 py-1">
            {s.status === "done" ? "CLEAR" : `LV ${s.levelId}`}
          </span>
          {s.status !== "done" && (
            <span className="absolute bottom-1 right-2 text-rose text-sm drop-shadow" aria-label={`남은 기회 ${s.attemptsLeft}`}>
              {"♥".repeat(Math.max(0, s.attemptsLeft))}
            </span>
          )}
        </div>
        {!compact && (
          <div className="p-2 text-xs space-y-1 flex-1">
            <p className="line-clamp-2 min-h-[2.5em] text-ink/80">{s.lastAttempt ? `“${s.lastAttempt.prompt}”` : "아직 제출 전"}</p>
            {s.lastAttempt && (
              <div className="h-2 bg-ink/10">
                <div className={`h-full ${s.lastAttempt.passed ? "bg-mint" : "bg-orange"}`} style={{ width: `${s.lastAttempt.score}%` }} />
              </div>
            )}
          </div>
        )}
        <div className="px-2 py-2 flex items-center justify-between text-sm border-t-2 border-ink/10">
          <span className="font-bold truncate">
            👤 {s.number} {s.nickname}
          </span>
          <span className="text-orange-deep text-xs">★{s.passedCount}</span>
        </div>
      </button>
    </li>
  );
}

function LevelBars({ counts, done, total }: { counts: DashboardSnapshot["summary"]["levelCounts"]; done: number; total: number }) {
  const max = Math.max(1, total);
  return (
    <div className="grid grid-cols-6 gap-2 items-end h-24" aria-label="레벨별 학생 수">
      {[...counts.map((c) => ({ key: `LV${c.levelId}`, title: c.title, count: c.count })), { key: "완료", title: "모든 레벨 완료", count: done }].map((b) => (
        <div key={b.key} className="flex flex-col items-center gap-1 h-full justify-end" title={`${b.title}: ${b.count}명`}>
          <span className="text-xs font-bold">{b.count}</span>
          <div className="w-full bg-violet" style={{ height: `${(b.count / max) * 100}%`, minHeight: b.count ? 6 : 2 }} />
          <span className="text-[10px] font-bold">{b.key}</span>
        </div>
      ))}
    </div>
  );
}

function DetailPanel({
  classId,
  studentId,
  version,
  onClose,
  onSpotlight,
}: {
  classId: string;
  studentId: string;
  version: string;
  onClose: () => void;
  onSpotlight: (s: Spotlight) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/teacher/classes/${classId}/students/${studentId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => alive && setDetail(d));
    return () => {
      alive = false;
    };
  }, [classId, studentId, version]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-30 flex justify-end bg-night/60" onClick={onClose} role="dialog" aria-modal="true">
      <aside className="h-full w-full max-w-md bg-cream text-ink overflow-y-auto border-l-8 border-ink" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-orange px-4 py-3 flex items-center justify-between border-b-4 border-ink">
          <p className="font-bold text-lg">{detail ? `${detail.student.number}번 ${detail.student.nickname}` : "불러오는 중…"}</p>
          <button onClick={onClose} className="font-bold text-xl" aria-label="닫기">
            ✕
          </button>
        </div>
        {detail && (
          <ol className="p-4 space-y-3">
            {detail.attempts.length === 0 && <li className="text-sm text-ink/60">아직 제출한 설명이 없어요.</li>}
            {detail.attempts.map((a, i) => {
              const newImage = i === 0 || detail.attempts[i - 1].imageId !== a.imageId;
              return (
                <li key={i} className="space-y-2">
                  {newImage && (
                    <div className="flex items-center gap-2 pt-2">
                      {a.imageSrc && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageSrc} alt="" className="w-16 h-12 object-cover border-2 border-ink" />
                      )}
                      <div className="text-xs">
                        <p className="font-bold">LV {a.levelId}</p>
                        <p className="text-ink/60">모범: {a.reference}</p>
                      </div>
                    </div>
                  )}
                  <div className={`p-2 border-2 ${a.flagged ? "border-rose bg-rose/10" : a.passed ? "border-mint bg-mint/10" : "border-ink/30 bg-white"}`}>
                    <p className="text-sm">“{a.prompt}”</p>
                    <div className="flex items-center justify-between text-xs mt-1">
                      <span className="font-bold">
                        {a.flagged ? "🚩 " + a.feedback : `${a.score}점 ${a.passed ? "✔ 통과" : ""}`}
                      </span>
                      <span className="text-ink/50">{new Date(a.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                    {!a.flagged && (
                      <button
                        className="mt-2 text-xs underline text-violet"
                        onClick={() => onSpotlight({ prompt: a.prompt, imageSrc: a.imageSrc, who: `${detail.student.nickname}`, score: a.score })}
                      >
                        📣 모두에게 보여주기
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </div>
  );
}

function SpotlightView({ s, onClose }: { s: Spotlight; onClose: () => void }) {
  const [anonymous, setAnonymous] = useState(true);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 bg-night grid place-items-center p-6" role="dialog" aria-modal="true">
      <div className="max-w-5xl w-full grid gap-8 md:grid-cols-2 items-center pop">
        {s.imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.imageSrc} alt="" className="w-full border-8 border-cream bg-white" />
        )}
        <div className="space-y-6">
          <p className="text-3xl sm:text-5xl font-bold leading-snug text-cream">“{s.prompt}”</p>
          <p className="text-xl text-orange">
            — {anonymous ? "우리 반 친구" : s.who} · {s.score}점
          </p>
          <div className="flex gap-3">
            <button className="pixel-btn secondary" onClick={() => setAnonymous((a) => !a)}>
              {anonymous ? "이름 보이기" : "이름 숨기기"}
            </button>
            <button className="pixel-btn" onClick={onClose}>
              닫기 (Esc)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
