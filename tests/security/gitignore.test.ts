import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

function ignored(path: string) {
  try {
    execFileSync("git", ["check-ignore", "-q", "--no-index", path]);
    return true;
  } catch {
    return false;
  }
}

describe(".gitignore", () => {
  it.each([".env", ".env.local", ".env.production", "exports/class.xlsx", "results.csv", "images.zip"])(
    "%s 는 커밋되지 않는다",
    (p) => expect(ignored(p)).toBe(true),
  );

  it(".env.example 은 커밋된다", () => {
    expect(ignored(".env.example")).toBe(false);
  });
});
