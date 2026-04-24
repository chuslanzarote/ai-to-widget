/**
 * T067 — Data-Sovereignty probe (Feature 007, Principle I).
 *
 * Renders the full backend template pack into a temp directory, then
 * walks every emitted `.ts` file and — using the TypeScript compiler
 * API — visits every `CallExpression` whose callee is `fetch` (or
 * `globalThis.fetch`). For each call-site the first argument's URL is
 * resolved statically and classified against the allowlist defined in
 * `specs/007-widget-tool-loop/contracts/sovereignty-probe.md`.
 *
 * Anything that cannot be proven to point at `localhost`, `127.0.0.1`,
 * or a known atw-compose service is a failure. The probe is fail-closed
 * on unresolvable expressions.
 *
 * Success criterion: the list of offending call-sites is empty.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import ts from "typescript";

import {
  renderBackend,
  defaultTemplatesDir,
  type RuntimeToolDescriptor,
} from "../src/render-backend.js";

const BASE_CONTEXT = {
  projectName: "demo",
  embeddingModel: "Xenova/bge-small-multilingual-v1.5",
  anthropicModel: "claude-opus-4-7",
  generatedAt: "2026-04-23T00:00:00Z",
  defaultLocale: "en",
  briefSummary: "Demo brief.",
};

const ALLOWED_ORIGINS = [
  "http://localhost",
  "https://localhost",
  "http://127.0.0.1",
  "https://127.0.0.1",
  "http://atw_backend",
  "http://atw_postgres",
];

interface Finding {
  file: string;
  line: number;
  resolved: string;
  reason: "unresolvable" | "disallowed-origin";
}

let outputDir: string;
let tmpDir: string;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "atw-sovereignty-"));
  outputDir = path.join(tmpDir, "out");
  const tools: RuntimeToolDescriptor[] = [];
  await renderBackend({
    templatesDir: defaultTemplatesDir(),
    outputDir,
    context: {
      ...BASE_CONTEXT,
      tools,
      toolsJson: JSON.stringify(tools, null, 2),
    },
  });
}, 60_000);

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function walkTsFiles(root: string): Promise<string[]> {
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile() && e.name.endsWith(".ts")) out.push(full);
    }
  }
  return out;
}

function resolveUrlExpression(
  expr: ts.Expression,
  source: ts.SourceFile,
): { kind: "literal" | "template-head" | "identifier"; value: string } | null {
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) {
    return { kind: "literal", value: expr.text };
  }
  if (ts.isTemplateExpression(expr)) {
    // Static head before the first interpolation.
    return { kind: "template-head", value: expr.head.text };
  }
  if (ts.isIdentifier(expr)) {
    const name = expr.text;
    // Search the same file for a const declaration with a string initializer.
    let resolved: string | null = null;
    const visit = (n: ts.Node): void => {
      if (resolved !== null) return;
      if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === name) {
        if (n.initializer) {
          const inner = resolveUrlExpression(n.initializer, source);
          if (inner) resolved = inner.value;
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(source);
    if (resolved !== null) return { kind: "identifier", value: resolved };
    return null;
  }
  return null;
}

function isAllowed(url: string): boolean {
  return ALLOWED_ORIGINS.some((origin) => url.startsWith(origin));
}

describe("Sovereignty probe (Feature 007 T067 / Principle I)", () => {
  it("every fetch() in the rendered backend targets an allowlisted origin", async () => {
    const files = await walkTsFiles(outputDir);
    const findings: Finding[] = [];

    for (const filePath of files) {
      const text = await fs.readFile(filePath, "utf8");
      const source = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TS,
      );

      const visit = (node: ts.Node): void => {
        if (ts.isCallExpression(node)) {
          const callee = node.expression;
          const isFetch =
            (ts.isIdentifier(callee) && callee.text === "fetch") ||
            (ts.isPropertyAccessExpression(callee) &&
              callee.name.text === "fetch" &&
              ts.isIdentifier(callee.expression) &&
              callee.expression.text === "globalThis");
          if (isFetch) {
            const arg0 = node.arguments[0];
            const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
            const rel = path.relative(outputDir, filePath);
            if (!arg0) {
              findings.push({
                file: rel,
                line: line + 1,
                resolved: "(no argument)",
                reason: "unresolvable",
              });
            } else {
              const resolved = resolveUrlExpression(arg0, source);
              if (!resolved) {
                findings.push({
                  file: rel,
                  line: line + 1,
                  resolved: arg0.getText(source),
                  reason: "unresolvable",
                });
              } else if (!isAllowed(resolved.value)) {
                findings.push({
                  file: rel,
                  line: line + 1,
                  resolved: resolved.value,
                  reason: "disallowed-origin",
                });
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(source);
    }

    if (findings.length > 0) {
      const msg = findings
        .map(
          (f) =>
            `  ${f.file}:${f.line}  [${f.reason}]  ${f.resolved}`,
        )
        .join("\n");
      throw new Error(
        `Sovereignty probe failed — ${findings.length} fetch() call-site(s) violate Principle I:\n${msg}`,
      );
    }
    expect(findings).toEqual([]);
  });
});
