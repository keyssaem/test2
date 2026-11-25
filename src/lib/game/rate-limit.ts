/** 아주 단순한 메모리 기반 슬라이딩 윈도 제한 (서버 1대 기준). */
export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return {
    check(key: string, now = Date.now()): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(now);
      hits.set(key, recent);
      return true;
    },
    reset() {
      hits.clear();
    },
  };
}

// 학생 1명당 1분에 8번까지 제출
export const attemptLimiter = createRateLimiter(8, 60_000);
// 같은 IP에서 1분에 30번까지 입장 시도
export const joinLimiter = createRateLimiter(30, 60_000);
// 교사 코드 무차별 대입 방지: IP당 1분에 5번
export const teacherLoginLimiter = createRateLimiter(5, 60_000);
