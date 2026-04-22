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
  hostApiBaseUrl: string | null;
  hostApiKey: string | null;
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
    hostApiBaseUrl: env.HOST_API_BASE_URL?.trim() || null,
    hostApiKey: env.HOST_API_KEY?.trim() || null,
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
