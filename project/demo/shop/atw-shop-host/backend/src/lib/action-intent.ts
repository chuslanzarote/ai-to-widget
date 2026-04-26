import type { ActionIntent, SessionContext } from "@atw/scripts/dist/lib/types.js";
import type { RuntimeToolDescriptor } from "../tools.js";

/**
 * Construct an action intent from a tool-use emission. Resolves
 * `{field}` path placeholders from the SessionContext. Returns `null`
 * when a required placeholder is not present — the caller converts that
 * into a synthetic tool_result so Opus can narrate around the gap.
 *
 * Source: specs/003-runtime/contracts/chat-endpoint.md §5.
 */

export interface BuildActionIntentInput {
  tool: RuntimeToolDescriptor;
  toolUseId: string;
  args: Record<string, unknown>;
  sessionContext: SessionContext;
}

export function buildActionIntent(
  input: BuildActionIntentInput,
): ActionIntent | { unresolved: string[] } {
  const unresolved: string[] = [];
  const resolvedPath = input.tool.http.path_template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key) => {
    const v = resolveKey(key, input.args, input.sessionContext);
    if (v === null || v === undefined || v === "") {
      unresolved.push(key);
      return `{${key}}`;
    }
    return encodeURIComponent(String(v));
  });
  if (unresolved.length > 0) return { unresolved };
  const description = renderDescription(input.tool, input.args);
  return {
    id: input.toolUseId,
    tool: input.tool.name,
    arguments: input.args,
    description,
    summary_template: input.tool.summary_template,
    requires_confirmation: input.tool.requires_confirmation,
    confirmation_required: true,
    http: { method: input.tool.http.method, path: resolvedPath },
    summary: renderSummary(input.tool, input.args),
  };
}

function resolveKey(
  key: string,
  args: Record<string, unknown>,
  ctx: SessionContext,
): unknown {
  if (key in args) return args[key];
  if (key === "cart_id") return ctx.cart_id ?? null;
  if (key === "customer_id") return ctx.customer_id ?? null;
  if (key === "region_id") return ctx.region_id ?? null;
  return null;
}

function renderDescription(
  tool: RuntimeToolDescriptor,
  args: Record<string, unknown>,
): string {
  // FR-022: substitute {{ placeholder \}} from summary_template using
  // tool-call args. When a placeholder is missing, build a deterministic
  // fallback from name + remaining args (no Opus narration fallback).
  const tpl = tool.summary_template;
  let unresolved = false;
  const out = tpl.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    const v = args[key];
    if (v === undefined || v === null || v === "") {
      unresolved = true;
      return `{{${key}}}`;
    }
    return String(v);
  });
  if (!unresolved) return out;
  const argsStr = Object.entries(args)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");
  return argsStr.length > 0 ? `${tool.name} (${argsStr})` : tool.name;
}

function renderSummary(
  tool: RuntimeToolDescriptor,
  args: Record<string, unknown>,
): Record<string, string> | undefined {
  // Surface every placeholder key from summary_template that resolves to a
  // present argument. This keeps the action-intent payload self-contained.
  const keys = new Set<string>();
  const re = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(tool.summary_template)) !== null) {
    keys.add(m[1]);
  }
  const out: Record<string, string> = {};
  for (const k of keys) {
    const v = args[k];
    if (v !== undefined && v !== null && v !== "") out[k] = String(v);
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
