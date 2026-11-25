import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRepo } from "@/lib/data/memory-repo";
import { keywordScore } from "@/lib/game/scoring";
import { GameError, getStudentView, joinClass, submitAttempt, type Scorer } from "@/lib/game/service";

const keyword: Scorer = async (img, p) => keywordScore(img, p);

describe("학생 게임 서비스", () => {
  let repo: ReturnType<typeof createMemoryRepo>;
  beforeEach(() => {
    repo = createMemoryRepo();
  });

  async function join(number = 3, nickname = "반짝별") {
    const { student, cls } = await joinClass(repo, { code: "demo01", number, nickname });
    return { studentId: student.id, classId: cls.id, exp: 9e9 };
  }

  it("학급 코드로 입장하고, 같은 번호로 다시 들어오면 같은 학생", async () => {
    const a = await join(3, "반짝별");
    const b = await join(3, "새별명");
    expect(b.studentId).toBe(a.studentId);
    expect((await repo.getStudent(a.studentId))!.nickname).toBe("새별명");
  });

  it.each([
    [{ code: "NOPE00", number: 1, nickname: "a" }, "CLASS_NOT_FOUND"],
    [{ code: "DEMO01", number: 0, nickname: "a" }, "BAD_INPUT"],
    [{ code: "DEMO01", number: 1, nickname: "<script>" }, "BAD_INPUT"],
    [{ code: "DEMO01", number: 1, nickname: "열세글자가넘는아주긴별명입니다" }, "BAD_INPUT"],
  ])("잘못된 입장 %#", async (input, code) => {
    await expect(joinClass(repo, input)).rejects.toMatchObject({ code });
  });

  it("화면 정보에는 정답(모범 설명·키워드)이 없다", async () => {
    const view = await getStudentView(repo, await join());
    const json = JSON.stringify(view);
    expect(json).not.toContain("빨간 사과 한 개");
    expect(json).not.toContain("keywords");
    expect(view.image.src).toBe("/targets/l1-apple.svg");
  });

  it("세션 없이 접근하면 NO_SESSION", async () => {
    await expect(getStudentView(repo, null)).rejects.toMatchObject({ code: "NO_SESSION" });
  });

  it("다른 학급 id로 위조된 세션은 거부", async () => {
    const s = await join();
    await expect(getStudentView(repo, { ...s, classId: "other" })).rejects.toBeInstanceOf(GameError);
  });

  it("오답 → 팁과 기회 감소, 정답 → 통과와 모범 설명 공개", async () => {
    const s = await join();
    const r1 = await submitAttempt(repo, keyword, s, { prompt: "사과가 있어요" });
    expect(r1).toMatchObject({ score: 50, passed: false, outcome: "retry", reference: null });
    expect(r1.tips.length).toBeGreaterThan(0);
    expect(r1.view.attemptsLeft).toBe(2);

    const r2 = await submitAttempt(repo, keyword, s, { prompt: "빨간 사과" });
    expect(r2).toMatchObject({ score: 100, passed: true, outcome: "image-passed" });
    expect(r2.reference).toBe("빨간 사과 한 개");
    expect(r2.view.image.index).toBe(1);
  });

  it("욕설은 AI로 보내지 않고, 기회도 깎지 않고, 교사용으로 표시", async () => {
    const s = await join();
    const scorer = vi.fn(keyword);
    const r = await submitAttempt(repo, scorer, s, { prompt: "바보 사과" });
    expect(r.outcome).toBe("blocked");
    expect(scorer).not.toHaveBeenCalled();
    expect(r.view.attemptsLeft).toBe(3);
    const [rec] = await repo.listAttempts(s.studentId, "l1-apple");
    expect(rec.flagged).toBe(true);
  });

  it("전화번호가 섞이면 내용을 저장하지 않는다", async () => {
    const s = await join();
    await submitAttempt(repo, keyword, s, { prompt: "사과 010-1234-5678" });
    const [rec] = await repo.listAttempts(s.studentId, "l1-apple");
    expect(rec.prompt).not.toContain("010");
  });

  it("100자 넘는 설명은 거부", async () => {
    const s = await join();
    await expect(submitAttempt(repo, keyword, s, { prompt: "가".repeat(101) })).rejects.toMatchObject({ code: "BAD_INPUT" });
  });

  it("선생님이 일시정지하면 제출 불가", async () => {
    const s = await join();
    repo.classes.get("demo-class")!.isPaused = true;
    await expect(submitAttempt(repo, keyword, s, { prompt: "빨간 사과" })).rejects.toMatchObject({ code: "PAUSED" });
  });

  it("AI가 부적절하다고 판단하면 점수가 높아도 통과 아님", async () => {
    const s = await join();
    const r = await submitAttempt(repo, async () => ({ matched: ["object", "color"], inappropriate: true, source: "claude" }), s, {
      prompt: "빨간 사과",
    });
    expect(r.passed).toBe(false);
  });
});
