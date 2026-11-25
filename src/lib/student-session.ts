import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 서명된 세션 토큰 (계정·이메일 없이 id만 담고 HMAC으로 서명).
 * 형식: base64url(payload).base64url(signature)
 * kind 로 학생/교사 토큰을 구분해, 학생 토큰을 교사 토큰으로 쓰지 못하게 한다.
 */
type Kind = "student" | "teacher";

export type StudentSession = { studentId: string; classId: string; exp: number };
export type TeacherSession = { teacherId: string; exp: number };

const STUDENT_TTL = 60 * 60 * 6; // 수업 하루 분량
const TEACHER_TTL = 60 * 60 * 12;

const b64url = (buf: Buffer | string) => Buffer.from(buf).toString("base64url");
const sign = (data: string, secret: string) => createHmac("sha256", secret).update(data).digest();

function createToken(kind: Kind, body: Record<string, string>, secret: string, now: number, ttl: number) {
  if (secret.length < 32) throw new Error("세션 비밀값이 너무 짧습니다.");
  const payload = b64url(JSON.stringify({ ...body, kind, exp: now + ttl }));
  return `${payload}.${b64url(sign(payload, secret))}`;
}

function verifyToken(kind: Kind, token: string | undefined, secret: string, now: number): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = sign(payload, secret);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data?.kind !== kind) return null;
    if (typeof data.exp !== "number" || data.exp <= now) return null;
    return data;
  } catch {
    return null;
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

export function createStudentToken(s: Omit<StudentSession, "exp">, secret: string, now = nowSec(), ttl = STUDENT_TTL) {
  return createToken("student", { studentId: s.studentId, classId: s.classId }, secret, now, ttl);
}

export function verifyStudentToken(token: string | undefined, secret: string, now = nowSec()): StudentSession | null {
  const d = verifyToken("student", token, secret, now);
  if (!d || typeof d.studentId !== "string" || typeof d.classId !== "string") return null;
  return { studentId: d.studentId, classId: d.classId, exp: d.exp as number };
}

export function createTeacherToken(teacherId: string, secret: string, now = nowSec(), ttl = TEACHER_TTL) {
  return createToken("teacher", { teacherId }, secret, now, ttl);
}

export function verifyTeacherToken(token: string | undefined, secret: string, now = nowSec()): TeacherSession | null {
  const d = verifyToken("teacher", token, secret, now);
  if (!d || typeof d.teacherId !== "string") return null;
  return { teacherId: d.teacherId, exp: d.exp as number };
}
