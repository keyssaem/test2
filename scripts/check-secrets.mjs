#!/usr/bin/env node
// 사용법
//   node scripts/check-secrets.mjs --staged   커밋 직전 스테이징된 파일 검사 (git hook)
//   node scripts/check-secrets.mjs --repo     git이 추적하는/추적할 모든 파일 검사
//   node scripts/check-secrets.mjs --bundle   빌드된 브라우저 번들(.next/static) 검사
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { parseEnvSecrets, scanText } from "./secret-scan-core.mjs";

const mode = process.argv[2] ?? "--repo";
const ALLOW = new Set([".env.example"]);
const BINARY = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|pdf|zip)$/i;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).split("\n").filter(Boolean);
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

let files;
if (mode === "--staged") files = git(["diff", "--cached", "--name-only", "--diff-filter=ACM"]);
else if (mode === "--bundle") {
  if (!existsSync(".next/static")) {
    console.error("✖ .next/static 이 없습니다. 먼저 npm run build 를 실행하세요.");
    process.exit(2);
  }
  files = walk(".next/static");
} else files = git(["ls-files", "--cached", "--others", "--exclude-standard"]);

// 1) .env 계열 파일이 커밋 대상에 섞였는지
const envFiles = files.filter((f) => /(^|[\\/])\.env(\.|$)/.test(f) && !ALLOW.has(f.split(/[\\/]/).pop()));
// 2) 내용 검사
const known = existsSync(".env.local") ? parseEnvSecrets(readFileSync(".env.local", "utf8")) : [];
const problems = envFiles.map((f) => ({ file: f, rule: "env-file-tracked", sample: "-" }));

for (const f of files) {
  if (BINARY.test(f) || !existsSync(f)) continue;
  const text = readFileSync(f, "utf8");
  for (const hit of scanText(text, known)) problems.push({ file: f, ...hit });
}

if (problems.length) {
  console.error(`✖ 비밀값 유출 의심 ${problems.length}건 (${mode})`);
  for (const p of problems) console.error(`  - ${p.file}  [${p.rule}]  ${p.sample}`);
  process.exit(1);
}
console.log(`✔ 비밀값 검사 통과 (${mode}, 파일 ${files.length}개)`);
