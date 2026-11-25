// 비밀값 탐지 규칙 (외부 바이너리 없이 Node만으로 동작)

export const RULES = [
  { id: "anthropic-key", re: /sk-ant-[A-Za-z0-9_-]{20,}/g },
  { id: "openai-key", re: /sk-(?:proj-)?[A-Za-z0-9]{32,}/g },
  { id: "google-api-key", re: /AIza[0-9A-Za-z_-]{35}/g },
  { id: "private-key-block", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  // .env 형식으로 비밀값이 채워진 줄 (빈 값은 허용)
  {
    id: "env-secret-assignment",
    re: /^(?:SUPABASE_SERVICE_ROLE_KEY|ANTHROPIC_API_KEY|STUDENT_SESSION_SECRET)[ \t]*=[ \t]*[^\s#]+/gm,
  },
];

/** JWT 중 role 이 service_role 인 것만 잡는다 (anon 키는 공개용이라 허용). */
function findServiceRoleJwts(text) {
  const hits = [];
  for (const m of text.matchAll(/eyJ[A-Za-z0-9_-]+\.(eyJ[A-Za-z0-9_-]+)\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(m[1], "base64url").toString("utf8"));
      if (payload && payload.role === "service_role") hits.push(m[0]);
    } catch {
      /* JWT가 아님 */
    }
  }
  return hits;
}

/**
 * @param {string} text
 * @param {string[]} knownSecrets .env.local 에 실제로 들어 있는 비밀값들
 * @returns {{rule: string, sample: string}[]}
 */
export function scanText(text, knownSecrets = []) {
  const findings = [];
  for (const { id, re } of RULES) {
    for (const m of text.matchAll(re)) findings.push({ rule: id, sample: mask(m[0]) });
  }
  for (const jwt of findServiceRoleJwts(text)) findings.push({ rule: "supabase-service-role-jwt", sample: mask(jwt) });
  for (const s of knownSecrets) {
    if (s && s.length >= 12 && text.includes(s)) findings.push({ rule: "env-local-value", sample: mask(s) });
  }
  return findings;
}

export function mask(s) {
  return s.length <= 8 ? "****" : `${s.slice(0, 4)}…${s.slice(-2)} (${s.length}자)`;
}

/** .env.local 의 서버 전용 값만 추출 (NEXT_PUBLIC_ 값은 공개용이므로 제외) */
export function parseEnvSecrets(envText) {
  const out = [];
  for (const line of envText.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m || m[1].startsWith("NEXT_PUBLIC_")) continue;
    const v = m[2].replace(/^["']|["']$/g, "");
    if (v) out.push(v);
  }
  return out;
}
