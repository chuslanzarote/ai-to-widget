/**
 * Runtime configuration resolution — shared between the rendered backend
 * (`packages/backend/src/config.ts` after Feature 002's render) and the
 * contract tests that verify startup failure modes (T099 / U2 finding).
 *
 * Source: specs/003-runtime/contracts/chat-endpoint.md §9.
 */

export interface RuntimeConfig {
  port: number;
  databaseUrl: string;
  anthropicApiKey: string;
  allowedOrigins: string[];
  retrievalThreshold: number;
  retrievalTopK: number;
  maxConversationTurns: number;
  maxToolCallsPerTurn: number;
  rateLimitMax: number;
  rateLimitWindowMs: number;
  logLevel: string;
  nodeEnv: string;
}

export class ConfigError extends Error {
  constructor(public readonly missing: string[]) {
    super(
      `atw-backend: missing required environment variables: ${missing.join(
        ", ",
      )}. See specs/003-runtime/contracts/chat-endpoint.md §9.`,
    );
  }
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const missing: string[] = [];

  function required(name: string): string {
    const v = env[name];
    if (!v || v.length === 0) missing.push(name);
    return v ?? "";
  }

  function num(name: string, fallback: number): number {
    const v = env[name];
    if (!v) return fallback;
    const parsed = Number(v);
    if (!Number.isFinite(parsed)) {
      throw new ConfigError([`${name} is not a finite number (got "${v}")`]);
    }
    return parsed;
  }

  function parseOrigins(raw: string): string[] {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  const databaseUrl = required("DATABASE_URL");
  const anthropicApiKey = required("ANTHROPIC_API_KEY");
  const allowedOriginsRaw = required("ALLOWED_ORIGINS");

  if (missing.length > 0) throw new ConfigError(missing);

  return {
    port: num("PORT", 3100),
    databaseUrl,
    anthropicApiKey,
    allowedOrigins: parseOrigins(allowedOriginsRaw),
    retrievalThreshold: num("RETRIEVAL_SIMILARITY_THRESHOLD", 0.55),
    retrievalTopK: num("RETRIEVAL_TOP_K", 8),
    maxConversationTurns: num("MAX_CONVERSATION_TURNS", 20),
    maxToolCallsPerTurn: num("MAX_TOOL_CALLS_PER_TURN", 5),
    rateLimitMax: num("RATE_LIMIT_MAX", 60),
    rateLimitWindowMs: num("RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000),
    logLevel: env.LOG_LEVEL ?? (env.NODE_ENV === "production" ? "info" : "debug"),
    nodeEnv: env.NODE_ENV ?? "development",
  };
}

/* ============================================================================
 * Feature 009 — Project config loader (FR-006, R6)
 *
 * Reads `.atw/config/project.md` YAML frontmatter and validates it via the
 * Feature 009 zod schema. Used by the LLM-driven phases to resolve the
 * pinned `model_snapshot` and the four origin fields.
 * ========================================================================= */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import {
  ProjectConfigSchema,
  checkProjectConfigInvariants,
  type ProjectConfig,
} from "./schemas/project-md.js";

export class ProjectConfigError extends Error {
  constructor(
    message: string,
    public readonly issues: ReadonlyArray<{ path: string; message: string }>,
  ) {
    super(message);
    this.name = "ProjectConfigError";
  }
}

export interface LoadProjectConfigOptions {
  projectRoot?: string;
  /** Allow atw_backend_origin === host_api_origin (rare, single-process demos). */
  allowSameOrigin?: boolean;
}

export const DEFAULT_PROJECT_MD_PATH = ".atw/config/project.md";

/**
 * Reads `.atw/config/project.md` and returns the validated frontmatter.
 * Defaults `model_snapshot` to `claude-opus-4-7` when the field is absent.
 * Throws `ProjectConfigError` with a list of `{path, message}` issues when
 * structural or cross-field validation fails.
 */
export function loadProjectConfig(
  opts: LoadProjectConfigOptions = {},
): ProjectConfig {
  const root = opts.projectRoot ?? process.cwd();
  const abs = join(root, DEFAULT_PROJECT_MD_PATH);
  if (!existsSync(abs)) {
    throw new ProjectConfigError(`project.md not found at ${abs}`, [
      { path: ".", message: "missing project.md — run /atw.init first" },
    ]);
  }
  const raw = readFileSync(abs, "utf8");
  const parsed = matter(raw);
  const data = parsed.data ?? {};

  const result = ProjectConfigSchema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    throw new ProjectConfigError("project.md frontmatter failed schema validation", issues);
  }
  const cfg = result.data;
  const invariantIssues = checkProjectConfigInvariants(cfg, {
    allowSameOrigin: opts.allowSameOrigin,
  });
  if (invariantIssues.length > 0) {
    throw new ProjectConfigError(
      "project.md frontmatter failed cross-field invariants",
      invariantIssues,
    );
  }
  return cfg;
}
