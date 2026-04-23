/**
 * T055 — Interpreter safety static grep (SC-006).
 *
 * Covers contracts/widget-executor-engine.md §9 banned-constructs list.
 *
 * The widget's action interpreter is a **fixed, audited code path**:
 * no eval, no new Function, no dynamic import with a variable
 * argument, no DOMParser, no innerHTML / outerHTML assignment, no
 * document.write, no dangerouslySetInnerHTML. This contract test is a
 * structural guard: if any of those slip into the three files below,
 * the test fails with a path + line diagnostic so the offender is
 * obvious in CI.
 *
 * Scoped to the three interpreter files (action-executors.ts,
 * api-client-action.ts, action-card.tsx) — the only files that read
 * catalog-derived or host-derived strings into the DOM.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SRC_DIR = path.join(__dirname, "..", "src");

const FILES = [
  "action-executors.ts",
  "api-client-action.ts",
  "action-card.tsx",
];

interface BannedPattern {
  name: string;
  re: RegExp;
}

const BANNED: BannedPattern[] = [
  { name: "eval(", re: /\beval\s*\(/ },
  { name: "new Function(", re: /\bnew\s+Function\s*\(/ },
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/ },
  { name: "DOMParser", re: /\bDOMParser\b/ },
  { name: "innerHTML =", re: /\.innerHTML\s*=/ },
  { name: "outerHTML =", re: /\.outerHTML\s*=/ },
  { name: "document.write", re: /\bdocument\s*\.\s*write\b/ },
  // Dynamic `import(` with a variable argument. A literal-string
  // dynamic import like `import("./foo.js")` is OK; `import(someVar)`
  // is NOT. We detect the latter by looking for an identifier (or
  // template literal) immediately inside `import(`.
  {
    name: "dynamic import(variable)",
    re: /\bimport\s*\(\s*[a-zA-Z_$`]/,
  },
];

// Lines that start with a single-line comment, block-comment body, or
// are inside a string literal are hard to strip perfectly; scoping to
// our three hand-written source files keeps false-positive risk low,
// and the only way to silence a real violation is to remove it.

function scan(file: string): Array<{ pattern: string; lineNo: number; line: string }> {
  const abs = path.join(SRC_DIR, file);
  if (!existsSync(abs)) return [];
  const text = readFileSync(abs, "utf8");
  const lines = text.split("\n");
  const hits: Array<{ pattern: string; lineNo: number; line: string }> = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip block-comment-body and single-line comment lines: the
    // contract text in headers sometimes names the banned constructs.
    const trimmed = line.trim();
    if (
      trimmed.startsWith("//") ||
      trimmed.startsWith("*") ||
      trimmed.startsWith("/*")
    )
      continue;
    for (const { name, re } of BANNED) {
      if (re.test(line)) {
        hits.push({ pattern: name, lineNo: i + 1, line: line.trim() });
      }
    }
  }
  return hits;
}

describe("interpreter safety static grep (T055 / SC-006)", () => {
  for (const file of FILES) {
    it(`${file} has no banned constructs`, () => {
      const hits = scan(file);
      if (hits.length > 0) {
        const detail = hits
          .map((h) => `  ${file}:${h.lineNo}  ${h.pattern}  ← ${h.line}`)
          .join("\n");
        throw new Error(
          `interpreter-safety violation(s) in ${file}:\n${detail}`,
        );
      }
      expect(hits).toEqual([]);
    });
  }

  it("each banned construct is individually absent across all three files", () => {
    for (const { name } of BANNED) {
      const violations: string[] = [];
      for (const file of FILES) {
        const hits = scan(file).filter((h) => h.pattern === name);
        for (const h of hits) {
          violations.push(`${file}:${h.lineNo} — ${h.line}`);
        }
      }
      expect(
        violations,
        `banned "${name}" must have zero matches across ${FILES.join(", ")}`,
      ).toEqual([]);
    }
  });

  it("scanner finds every file under test (guards against silent file-miss)", () => {
    for (const file of FILES) {
      const abs = path.join(SRC_DIR, file);
      expect(existsSync(abs)).toBe(true);
    }
  });
});
