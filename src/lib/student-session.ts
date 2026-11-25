import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * 학생 세션 토큰: 계정·이메일 없이 "학급 + 학생 id"만 담고 HMAC으로 서명한다.
 * 형식: base64url(payload).base64url(signature)
 */
export type StudentSession = {
  studentId: string;
  classId: string;
  exp: number; // epoch seconds
};

const DEFAULT_TTL_SECONDS = 60 * 60 * 6; // 수업 하루 분량

function b64url(buf: Buffer | string) {
  return Buffer.from(buf).toString("base64url");
}

function sign(data: string, secret: string) {
  return createHmac("sha256", secret).update(data).digest();
}

export function createStudentToken(
  session: Omit<StudentSession, "exp">,
  secret: string,
  now = Math.floor(Date.now() / 1000),
  ttl = DEFAULT_TTL_SECONDS,
): string {
  if (secret.length < 32) throw new Error("세션 비밀값이 너무 짧습니다.");
  const payload = b64url(JSON.stringify({ ...session, exp: now + ttl }));
  return `${payload}.${b64url(sign(payload, secret))}`;
}

export function verifyStudentToken(
  token: string | undefined,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): StudentSession | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;

  const expected = sign(payload, secret);
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as StudentSession;
    if (typeof data.studentId !== "string" || typeof data.classId !== "string") return null;
    if (typeof data.exp !== "number" || data.exp <= now) return null;
    return data;
  } catch {
    return null;
  }
}
