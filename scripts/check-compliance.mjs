#!/usr/bin/env node
/**
 * Pre-push / pre-commit gate for pain-frontend.
 * Run: npm run check
 *
 * Catches issues Vite build alone does not (tsc, dead exports, backend contract).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = path.join(root, "src");

const errors = [];
const warnings = [];

function rel(p) {
  return path.relative(root, p);
}

function run(label, cmd) {
  console.log(`→ ${label} …`);
  try {
    execSync(cmd, { cwd: root, stdio: "inherit" });
    console.log(`  ✓ ${label} OK\n`);
    return true;
  } catch {
    errors.push(`${label} failed (${cmd})`);
    console.log(`  ✗ ${label} FAILED\n`);
    return false;
  }
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, name.name);
    if (name.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name.name)) out.push(p);
  }
  return out;
}

function readAllSrc() {
  return walk(srcDir).map((f) => ({
    f,
    text: fs.readFileSync(f, "utf8"),
  }));
}

console.log("PAIN compliance check\n");

// 1) TypeScript (Vite build does not run full tsc)
run("npm run typecheck", "npm run typecheck");

// 2) Production bundle
run("npm run build", "npm run build");

// 3) No dead exports in src/ (ts-prune)
console.log("→ ts-prune (unused exports in src/) …");
try {
  const out = execSync("npx ts-prune -p tsconfig.json", {
    cwd: root,
    encoding: "utf8",
  });
  const lines = out
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const ignorePatterns = [
    /^vite\.config\.ts:\d+ - default$/,
    /^src\/vite-env\.d\.ts:/,
  ];

  for (const line of lines) {
    if (ignorePatterns.some((re) => re.test(line))) continue;
    if (!line.startsWith("src/")) continue;

    if (line.includes("(used in module)")) {
      errors.push(
        `ts-prune: ${line} — remove 'export' (only used inside this file)`,
      );
    } else {
      errors.push(
        `ts-prune: ${line} — unused export; delete or wire up`,
      );
    }
  }

  if (lines.some((l) => l.startsWith("src/") && !ignorePatterns.some((re) => re.test(l)))) {
    console.log("  ✗ ts-prune reported issues (see FAILED list)\n");
  } else {
    console.log("  ✓ ts-prune OK\n");
  }
} catch (e) {
  errors.push(`ts-prune failed: ${e.message ?? e}`);
}

// 4) Public API modules: exported functions need a JSDoc block immediately above
const apiFiles = [
  "src/api/client.ts",
  "src/api/painServer.ts",
  "src/api/adapter.ts",
  "src/api/painServerRow.ts",
  "src/api/layers.ts",
  "src/api/mockClient.ts",
];

function hasJSDocAbove(text, exportIndex) {
  const before = text.slice(0, exportIndex);
  return /\/\*\*[\s\S]*?\*\/\s*$/.test(before.slice(-800));
}

for (const file of apiFiles) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  const re = /^export (async )?function (\w+)/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (!hasJSDocAbove(text, m.index)) {
      errors.push(`${file}: exported function ${m[2]}() missing JSDoc (/** … */)`);
    }
  }
}

// 5) Backend contract: src/ must not use server/ or CSV at runtime
const forbiddenPatterns = [
  { re: /from\s+['"][^'"]*server\//, msg: "imports from server/" },
  { re: /\b39000\b/, msg: "hardcoded 39000" },
  { re: /data\/[^'"]+\.csv/, msg: "references data/*.csv in src/" },
  { re: /loadPainRepoPoints|server\/index/, msg: "local pain server loader" },
];

for (const { f, text } of readAllSrc()) {
  for (const { re, msg } of forbiddenPatterns) {
    if (re.test(text)) errors.push(`${rel(f)}: ${msg}`);
  }
  if (/fetch\s*\(\s*['"`]https?:\/\/127\.0\.0\.1/.test(text)) {
    warnings.push(`${rel(f)}: fetch to 127.0.0.1 — use apiUrl / VITE_PAIN_API_BASE`);
  }
}

if (fs.existsSync(path.join(root, "server"))) {
  warnings.push(
    "server/ exists for dev mock only — must not be imported from src/ in production paths",
  );
}

console.log("Summary\n");

if (warnings.length) {
  console.log("Warnings (advisory):");
  for (const w of warnings) console.log(`  ⚠ ${w}`);
  console.log();
}

if (errors.length) {
  console.error("FAILED:\n");
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.error("\nSee docs/REVIEW_CHECKLIST.md and docs/BACKEND_CONTRACT.md\n");
  process.exit(1);
}

console.log("✓ All compliance checks passed.\n");
process.exit(0);
