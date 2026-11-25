import { describe, expect, it } from "vitest";
import { parseEnvSecrets, scanText } from "../../scripts/secret-scan-core.mjs";

// 가짜 비밀값은 문자열을 조합해 만든다 (테스트 파일 자체가 스캐너에 걸리지 않도록)
const fakeAnthropic = "sk-ant-" + "api03-" + "x".repeat(40);
const jwt = (role: string) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ role })).toString("base64url"), "c2lnbmF0dXJl"].join(".");

describe("비밀값 스캐너", () => {
  it("Anthropic 키를 잡는다", () => {
    expect(scanText(`const k = "${fakeAnthropic}"`).map((f: { rule: string }) => f.rule)).toContain("anthropic-key");
  });

  it("service_role JWT는 잡고 anon JWT는 허용한다", () => {
    expect(scanText(jwt("service_role"))).toHaveLength(1);
    expect(scanText(jwt("anon"))).toHaveLength(0);
  });

  it("값이 채워진 .env 줄은 잡고, 빈 예시(.env.example 형식)는 허용한다", () => {
    const filled = "ANTHROPIC_API_KEY=" + "abc123def456";
    expect(scanText(filled)).not.toHaveLength(0);
    const example = "SUPABASE_SERVICE_ROLE_KEY=\nANTHROPIC_API_KEY=\nSTUDENT_SESSION_SECRET=\n";
    expect(scanText(example)).toHaveLength(0);
  });

  it(".env.local 의 실제 값이 다른 파일에 복사되면 잡는다", () => {
    const secret = "my-real-" + "session-secret-value";
    expect(scanText(`log(${JSON.stringify(secret)})`, [secret])).toHaveLength(1);
  });

  it("parseEnvSecrets 는 NEXT_PUBLIC_ 값과 빈 값을 제외한다", () => {
    const env = "NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co\nANTHROPIC_API_KEY=\"secretvalue123\"\nSTUDENT_SESSION_SECRET=\n";
    expect(parseEnvSecrets(env)).toEqual(["secretvalue123"]);
  });
});
