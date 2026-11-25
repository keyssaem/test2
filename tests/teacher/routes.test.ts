import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as studentJoin } from "@/app/api/student/join/route";
import { POST as studentAttempt } from "@/app/api/student/attempt/route";
import { GET as listClasses, POST as createClass } from "@/app/api/teacher/classes/route";
import { DELETE as deleteClass, GET as snapshot, PATCH as patchClass } from "@/app/api/teacher/classes/[id]/route";
import { GET as studentDetail } from "@/app/api/teacher/classes/[id]/students/[studentId]/route";
import { GET as events } from "@/app/api/teacher/classes/[id]/events/route";
import { POST as login } from "@/app/api/teacher/login/route";
import { setRepoForTesting } from "@/lib/data";
import { createMemoryRepo } from "@/lib/data/memory-repo";
import { attemptLimiter, joinLimiter, teacherLoginLimiter } from "@/lib/game/rate-limit";
import { resetServerEnvCache } from "@/lib/server-env";
import { createTeacherToken } from "@/lib/student-session";

const ORIGIN = "http://localhost:3000";
const SECRET = "q".repeat(64);
const PASS = "test-pass-" + "1234";
const saved = { ...process.env };

function req(path: string, init: { method?: string; body?: unknown; cookie?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json", origin: ORIGIN });
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? "GET",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}
const ctx = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });

async function teacherCookie() {
  const res = await login(req("/api/teacher/login", { method: "POST", body: { passcode: PASS } }));
  expect(res.status).toBe(200);
  return res.headers.get("set-cookie")!.split(";")[0];
}

describe("교사 API", () => {
  beforeAll(() => {
    Object.assign(process.env, { STUDENT_SESSION_SECRET: SECRET, DATA_BACKEND: "memory", ANTHROPIC_API_KEY: "", TEACHER_PASSCODE: PASS });
    resetServerEnvCache();
  });
  afterAll(() => {
    process.env = saved;
    resetServerEnvCache();
    setRepoForTesting(undefined);
  });
  beforeEach(() => {
    setRepoForTesting(createMemoryRepo());
    [attemptLimiter, joinLimiter, teacherLoginLimiter].forEach((l) => l.reset());
  });

  it("틀린 교사 코드는 401, 반복하면 429", async () => {
    const codes: number[] = [];
    for (let i = 0; i < 7; i++) {
      codes.push((await login(req("/api/teacher/login", { method: "POST", body: { passcode: "wrong-code" } }))).status);
    }
    expect(codes[0]).toBe(401);
    expect(codes).toContain(429);
  });

  it("로그인 없이 교사 API는 401", async () => {
    expect((await listClasses(req("/api/teacher/classes"))).status).toBe(401);
    expect((await snapshot(req("/api/teacher/classes/demo-class"), ctx({ id: "demo-class" }))).status).toBe(401);
  });

  it("학생 쿠키로는 교사 API를 쓸 수 없다", async () => {
    const j = await studentJoin(req("/api/student/join", { method: "POST", body: { code: "DEMO01", number: 1, nickname: "학생" } }));
    const studentCookie = j.headers.get("set-cookie")!.split(";")[0].replace("pq_student", "pq_teacher");
    expect((await listClasses(req("/api/teacher/classes", { cookie: studentCookie }))).status).toBe(401);
  });

  it("학급 만들기 → 목록에 보임", async () => {
    const cookie = await teacherCookie();
    const res = await createClass(req("/api/teacher/classes", { method: "POST", body: { name: "6-6 프롬프트" }, cookie }));
    expect(res.status).toBe(201);
    const { class: cls } = await res.json();
    expect(cls.joinCode).toMatch(/^[A-Z2-9]{6}$/);
    const list = await (await listClasses(req("/api/teacher/classes", { cookie }))).json();
    expect(list.classes.map((c: { name: string }) => c.name)).toContain("6-6 프롬프트");
  });

  it("학생 활동이 스냅샷과 상세에 나타난다", async () => {
    const cookie = await teacherCookie();
    const j = await studentJoin(req("/api/student/join", { method: "POST", body: { code: "DEMO01", number: 4, nickname: "넷" } }));
    const sc = j.headers.get("set-cookie")!.split(";")[0];
    await studentAttempt(req("/api/student/attempt", { method: "POST", body: { prompt: "빨간 사과" }, cookie: sc }));

    const snap = await (await snapshot(req("/api/teacher/classes/demo-class", { cookie }), ctx({ id: "demo-class" }))).json();
    expect(snap.students).toHaveLength(1);
    expect(snap.students[0]).toMatchObject({ number: 4, nickname: "넷", passedCount: 1 });

    const sid = snap.students[0].id;
    const detail = await (await studentDetail(req(`/api/teacher/classes/demo-class/students/${sid}`, { cookie }), ctx({ id: "demo-class", studentId: sid }))).json();
    expect(detail.attempts[0]).toMatchObject({ prompt: "빨간 사과", passed: true });
  });

  it("일시정지하면 학생 제출이 막히고(423), 재개하면 다시 된다", async () => {
    const cookie = await teacherCookie();
    const j = await studentJoin(req("/api/student/join", { method: "POST", body: { code: "DEMO01", number: 5, nickname: "다섯" } }));
    const sc = j.headers.get("set-cookie")!.split(";")[0];

    expect((await patchClass(req("/api/teacher/classes/demo-class", { method: "PATCH", body: { isPaused: true }, cookie }), ctx({ id: "demo-class" }))).status).toBe(200);
    expect((await studentAttempt(req("/api/student/attempt", { method: "POST", body: { prompt: "사과" }, cookie: sc }))).status).toBe(423);

    await patchClass(req("/api/teacher/classes/demo-class", { method: "PATCH", body: { isPaused: false }, cookie }), ctx({ id: "demo-class" }));
    expect((await studentAttempt(req("/api/student/attempt", { method: "POST", body: { prompt: "사과" }, cookie: sc }))).status).toBe(200);
  });

  it("다른 교사의 학급은 404 (존재 여부도 숨김)", async () => {
    const other = `pq_teacher=${createTeacherToken("someone-else", SECRET)}`;
    expect((await snapshot(req("/api/teacher/classes/demo-class", { cookie: other }), ctx({ id: "demo-class" }))).status).toBe(404);
    expect((await patchClass(req("/api/teacher/classes/demo-class", { method: "PATCH", body: { isPaused: true }, cookie: other }), ctx({ id: "demo-class" }))).status).toBe(404);
    expect((await deleteClass(req("/api/teacher/classes/demo-class", { method: "DELETE", cookie: other }), ctx({ id: "demo-class" }))).status).toBe(404);
    expect((await events(req("/api/teacher/classes/demo-class/events", { cookie: other }), ctx({ id: "demo-class" }))).status).toBe(404);
  });

  it("실시간 연결(SSE)이 열리고 ready 신호를 보낸다", async () => {
    const cookie = await teacherCookie();
    const ac = new AbortController();
    const r = new NextRequest(`${ORIGIN}/api/teacher/classes/demo-class/events`, { headers: { cookie }, signal: ac.signal });
    const res = await events(r, ctx({ id: "demo-class" }));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const reader = res.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain("event: ready");
    ac.abort();
    await reader.cancel();
  });

  it("학급 삭제 후에는 학생도 입장할 수 없다", async () => {
    const cookie = await teacherCookie();
    expect((await deleteClass(req("/api/teacher/classes/demo-class", { method: "DELETE", cookie }), ctx({ id: "demo-class" }))).status).toBe(200);
    expect((await studentJoin(req("/api/student/join", { method: "POST", body: { code: "DEMO01", number: 1, nickname: "a" } }))).status).toBe(404);
  });
});
