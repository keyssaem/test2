import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// DB 없이도 돌릴 수 있는 정적 검사. 실제 RLS 동작 검사는 Supabase 프로젝트 연결 후 추가한다.
const sql = readFileSync("supabase/migrations/0001_init.sql", "utf8");
const tables = [...sql.matchAll(/create table public\.(\w+)/g)].map((m) => m[1]);

describe("스키마 보안 규칙", () => {
  it("테이블이 정의되어 있다", () => {
    expect(tables.length).toBeGreaterThanOrEqual(5);
  });

  it.each(tables)("%s 테이블에 RLS가 켜져 있다", (t) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${t}\\s+enable row level security`));
  });

  it("정답 프롬프트는 DB에 저장하지 않는다", () => {
    expect(sql).not.toMatch(/reference_prompt/);
  });

  it("anon 역할 권한을 회수한다", () => {
    expect(sql).toMatch(/revoke all on all tables in schema public from anon/);
  });

  it("학생 테이블에 실명·이메일·전화 컬럼이 없다", () => {
    const students = sql.match(/create table public\.students \(([\s\S]*?)\);/)![1];
    expect(students).not.toMatch(/real_name|full_name|email|phone|birth/i);
  });

  it("학생 쓰기(insert/update) 정책이 클라이언트에 열려 있지 않다", () => {
    expect(sql).not.toMatch(/on public\.(students|attempts|student_progress) for (insert|update|all)/);
  });
});
