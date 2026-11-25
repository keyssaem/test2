import { normalize } from "./scoring";

/**
 * 초등 교실용 최소 금칙어 목록. 걸리면 AI로 보내지 않고, 기회도 깎지 않으며,
 * 교사 대시보드에 '확인 필요'로 표시된다.
 */
const BLOCKED = ["씨발", "시발", "ㅅㅂ", "ㅆㅂ", "병신", "ㅂㅅ", "개새", "존나", "ㅈㄴ", "닥쳐", "죽어", "죽일", "꺼져", "바보", "멍청"];

export function isInappropriate(prompt: string): boolean {
  const text = normalize(prompt);
  return BLOCKED.some((w) => text.includes(w));
}

/** 전화번호·이메일처럼 보이는 개인정보가 섞였는지 */
export function containsPersonalInfo(prompt: string): boolean {
  return /\d{2,3}[-\s.]?\d{3,4}[-\s.]?\d{4}/.test(prompt) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(prompt);
}
