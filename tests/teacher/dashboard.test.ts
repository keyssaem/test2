import { describe, expect, it } from "vitest";
import { createMemoryRepo, LOCAL_TEACHER_ID } from "@/lib/data/memory-repo";
import { onClassChange } from "@/lib/data/events";
import { keywordScore } from "@/lib/game/scoring";
import { joinClass, submitAttempt, type Scorer } from "@/lib/game/service";
import { buildSnapshot, buildStudentDetail, createClassWithCode, generateJoinCode } from "@/lib/teacher/dashboard";

const keyword: Scorer = async (img, p) => keywordScore(img, p);

describe("학급 코드", () => {
  it("6자리, 헷갈리는 글자(0 O 1 I L) 없음", () => {
    for (let i = 0; i < 200; i++) {
      const c = generateJoinCode();
      expect(c).toMatch(/^[A-Z2-9]{6}$/);
      expect(c).not.toMatch(/[01OIL]/);
    }
  });

  it("코드가 겹치면 다시 만든다", async () => {
    const repo = createMemoryRepo();
    let calls = 0;
    const orig = repo.createClass;
    repo.createClass = async (...args) => {
      if (calls++ === 0) throw new Error("JOIN_CODE_TAKEN");
      return orig(...args);
    };
    const cls = await createClassWithCode(repo, "t1", { name: "6-6" });
    expect(cls.name).toBe("6-6");
    expect(calls).toBe(2);
  });

  it("빈 이름은 거부", async () => {
    await expect(createClassWithCode(createMemoryRepo(), "t1", { name: "  " })).rejects.toMatchObject({ code: "BAD_INPUT" });
  });
});

describe("대시보드 스냅샷", () => {
  async function setup() {
    const repo = createMemoryRepo();
    const a = await joinClass(repo, { code: "DEMO01", number: 2, nickname: "둘" });
    const b = await joinClass(repo, { code: "DEMO01", number: 1, nickname: "하나" });
    const sa = { studentId: a.student.id, classId: a.cls.id, exp: 9e9 };
    await submitAttempt(repo, keyword, sa, { prompt: "사과" });
    await submitAttempt(repo, keyword, sa, { prompt: "바보" }); // 확인 필요
    await submitAttempt(repo, keyword, sa, { prompt: "빨간 사과" });
    const data = (await repo.loadClassData(LOCAL_TEACHER_ID, "demo-class"))!;
    return { repo, data, a, b };
  }

  it("학생 카드가 번호순이고 진행 정보가 담긴다", async () => {
    const { data } = await setup();
    const snap = buildSnapshot(data);
    expect(snap.students.map((s) => s.number)).toEqual([1, 2]);
    const two = snap.students[1];
    expect(two).toMatchObject({ levelId: 1, imageIndex: 1, passedCount: 1, attemptCount: 3, flaggedCount: 1 });
    expect(two.lastAttempt).toMatchObject({ prompt: "빨간 사과", passed: true });
    expect(two.imageSrc).toBe("/targets/l1-balloon.svg");
    expect(snap.summary).toMatchObject({ students: 2, flagged: 1, attempts: 3, done: 0 });
  });

  it("학생 상세는 오래된 순서, 모범 설명 포함", async () => {
    const { data, a } = await setup();
    const d = buildStudentDetail(data, a.student.id)!;
    expect(d.attempts.map((x) => x.prompt)).toEqual(["사과", "바보", "빨간 사과"]);
    expect(d.attempts[0].reference).toBe("빨간 사과 한 개");
    expect(buildStudentDetail(data, "nope")).toBeNull();
  });

  it("다른 교사는 학급 데이터를 볼 수도, 멈출 수도, 지울 수도 없다", async () => {
    const { repo } = await setup();
    expect(await repo.loadClassData("intruder", "demo-class")).toBeNull();
    expect(await repo.setPaused("intruder", "demo-class", true)).toBeNull();
    expect(await repo.deleteClass("intruder", "demo-class")).toBe(false);
    expect(await repo.listClasses("intruder")).toEqual([]);
  });

  it("학급을 지우면 학생 기록도 모두 사라진다", async () => {
    const { repo, a } = await setup();
    expect(await repo.deleteClass(LOCAL_TEACHER_ID, "demo-class")).toBe(true);
    expect(await repo.getStudent(a.student.id)).toBeNull();
    expect(await repo.getProgress(a.student.id)).toBeNull();
    expect(await repo.loadClassData(LOCAL_TEACHER_ID, "demo-class")).toBeNull();
    expect(await repo.listAttempts(a.student.id, "l1-apple")).toEqual([]);
  });

  it("학생이 제출하면 학급 변경 신호가 간다 (실시간)", async () => {
    const repo = createMemoryRepo();
    let n = 0;
    const off = onClassChange("demo-class", () => n++);
    const a = await joinClass(repo, { code: "DEMO01", number: 9, nickname: "구" });
    await submitAttempt(repo, keyword, { studentId: a.student.id, classId: a.cls.id, exp: 9e9 }, { prompt: "사과" });
    off();
    expect(n).toBeGreaterThanOrEqual(3); // 입장 + 진행 저장 + 시도 기록
  });
});
