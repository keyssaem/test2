import { NextRequest } from "next/server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { POST as attempt } from "@/app/api/student/attempt/route";
import { POST as join } from "@/app/api/student/join/route";
import { GET as state } from "@/app/api/student/state/route";
import { setRepoForTesting } from "@/lib/data";
import { createMemoryRepo } from "@/lib/data/memory-repo";
import { attemptLimiter, joinLimiter } from "@/lib/game/rate-limit";
import { resetServerEnvCache } from "@/lib/server-env";

const ORIGIN = "http://localhost:3000";
const saved = { ...process.env };

function req(path: string, init: { method?: string; body?: unknown; cookie?: string; origin?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json" });
  if (init.cookie) headers.set("cookie", init.cookie);
  if (init.origin !== undefined) headers.set("origin", init.origin);
  return new NextRequest(`${ORIGIN}${path}`, {
    method: init.method ?? "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function joinAndGetCookie() {
  const res = await join(req("/api/student/join", { body: { code: "DEMO01", number: 7, nickname: "테스터" }, origin: ORIGIN }));
  expect(res.status).toBe(200);
  const set = res.headers.get("set-cookie")!;
  return { set, cookie: set.split(";")[0] };
}

describe("학생 API", () => {
  beforeAll(() => {
    process.env.STUDENT_SESSION_SECRET = "r".repeat(64);
    process.env.DATA_BACKEND = "memory";
    process.env.ANTHROPIC_API_KEY = "";
    resetServerEnvCache();
  });
  afterAll(() => {
    process.env = saved;
    resetServerEnvCache();
    setRepoForTesting(undefined);
  });
  beforeEach(() => {
    setRepoForTesting(createMemoryRepo());
    attemptLimiter.reset();
    joinLimiter.reset();
  });

  it("입장하면 HttpOnly·SameSite=Strict 쿠키가 발급된다", async () => {
    const { set } = await joinAndGetCookie();
    expect(set).toMatch(/HttpOnly/i);
    expect(set).toMatch(/SameSite=Strict/i);
    expect(set).not.toContain("테스터"); // 쿠키에 별명 같은 정보가 그대로 들어가지 않음
  });

  it("쿠키 없이 상태 조회는 401", async () => {
    const res = await state(req("/api/student/state", { method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("위조된 쿠키는 401", async () => {
    const res = await state(req("/api/student/state", { method: "GET", cookie: "pq_student=abc.def" }));
    expect(res.status).toBe(401);
  });

  it("입장 → 상태 조회 → 제출 흐름", async () => {
    const { cookie } = await joinAndGetCookie();
    const s = await state(req("/api/student/state", { method: "GET", cookie }));
    expect(s.status).toBe(200);
    expect((await s.json()).level.id).toBe(1);

    const a = await attempt(req("/api/student/attempt", { body: { prompt: "빨간 사과" }, cookie, origin: ORIGIN }));
    expect(a.status).toBe(200);
    expect(await a.json()).toMatchObject({ passed: true, score: 100 });
  });

  it("다른 사이트(origin)에서 온 제출은 403", async () => {
    const { cookie } = await joinAndGetCookie();
    const res = await attempt(req("/api/student/attempt", { body: { prompt: "빨간 사과" }, cookie, origin: "https://evil.example" }));
    expect(res.status).toBe(403);
  });

  it("너무 자주 제출하면 429", async () => {
    const { cookie } = await joinAndGetCookie();
    const codes: number[] = [];
    for (let i = 0; i < 10; i++) {
      const r = await attempt(req("/api/student/attempt", { body: { prompt: "사과" }, cookie, origin: ORIGIN }));
      codes.push(r.status);
    }
    expect(codes).toContain(429);
  });

  it("깨진 JSON은 400, 서버 오류 내용은 노출하지 않음", async () => {
    const r = await join(new NextRequest(`${ORIGIN}/api/student/join`, { method: "POST", body: "{nope", headers: { origin: ORIGIN } }));
    expect(r.status).toBe(400);
  });
});
