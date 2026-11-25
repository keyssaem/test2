import { describe, expect, it } from "vitest";
import { createStudentToken, verifyStudentToken } from "@/lib/student-session";

const secret = "t".repeat(48);
const now = 1_800_000_000;
const who = { studentId: "stu-1", classId: "cls-1" };

describe("학생 세션 토큰", () => {
  it("정상 토큰은 검증된다", () => {
    const token = createStudentToken(who, secret, now);
    expect(verifyStudentToken(token, secret, now + 10)).toMatchObject(who);
  });

  it("다른 비밀값으로 만든 토큰은 거부", () => {
    const token = createStudentToken(who, "o".repeat(48), now);
    expect(verifyStudentToken(token, secret, now)).toBeNull();
  });

  it("내용을 바꾼(다른 학생으로 위조) 토큰은 거부", () => {
    const [, sig] = createStudentToken(who, secret, now).split(".");
    const forged = Buffer.from(JSON.stringify({ studentId: "stu-2", classId: "cls-1", exp: now + 999 })).toString("base64url");
    expect(verifyStudentToken(`${forged}.${sig}`, secret, now)).toBeNull();
  });

  it("만료된 토큰은 거부", () => {
    const token = createStudentToken(who, secret, now, 60);
    expect(verifyStudentToken(token, secret, now + 61)).toBeNull();
  });

  it("형식이 깨진 토큰은 거부", () => {
    expect(verifyStudentToken("garbage", secret, now)).toBeNull();
    expect(verifyStudentToken(undefined, secret, now)).toBeNull();
  });

  it("짧은 비밀값으로는 토큰을 만들 수 없다", () => {
    expect(() => createStudentToken(who, "short", now)).toThrow();
  });
});
