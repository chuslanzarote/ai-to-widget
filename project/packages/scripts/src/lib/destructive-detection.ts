import type { ParsedOpenAPI, ParsedOpenAPIOperation } from "./types.js";

/**
 * Destructive-operation detection (FR-031).
 *
 * Operations flagged as destructive must carry `requires_confirmation: true`
 * in the resulting api-map. Signals:
 *   1. HTTP verb is DELETE.
 *   2. operationId contains a destructive verb: cancel, delete, remove,
 *      revoke, refund, void, destroy, purge, wipe.
 *   3. The last path segment matches a destructive verb
 *      (`/orders/{id}/cancel`, `/carts/{id}/destroy`).
 *
 * A read-only verb (GET, HEAD, OPTIONS) is never destructive regardless
 * of the name.
 */

const DESTRUCTIVE_VERBS = new Set([
  "cancel",
  "delete",
  "remove",
  "revoke",
  "refund",
  "void",
  "destroy",
  "purge",
  "wipe",
]);

const READ_ONLY_METHODS = new Set(["get", "head", "options"]);

const OPERATION_ID_RX = /(cancel|delete|remove|revoke|refund|void|destroy|purge|wipe)/i;

export interface DestructiveFlag {
  operationId: string;
  path: string;
  method: string;
  reason: "http-delete" | "operation-id-verb" | "path-suffix-verb";
}

export function detectDestructiveOperations(parsed: ParsedOpenAPI): DestructiveFlag[] {
  const out: DestructiveFlag[] = [];
  for (const op of parsed.operations) {
    const flag = classifyOperation(op);
    if (flag) out.push(flag);
  }
  return out;
}

function classifyOperation(op: ParsedOpenAPIOperation): DestructiveFlag | null {
  if (READ_ONLY_METHODS.has(op.method)) return null;

  if (op.method === "delete") {
    return {
      operationId: op.id,
      path: op.path,
      method: op.method,
      reason: "http-delete",
    };
  }

  if (OPERATION_ID_RX.test(op.id)) {
    return {
      operationId: op.id,
      path: op.path,
      method: op.method,
      reason: "operation-id-verb",
    };
  }

  const lastSegment = lastPathSegment(op.path);
  if (lastSegment && DESTRUCTIVE_VERBS.has(lastSegment.toLowerCase())) {
    return {
      operationId: op.id,
      path: op.path,
      method: op.method,
      reason: "path-suffix-verb",
    };
  }

  return null;
}

function lastPathSegment(path: string): string | null {
  const parts = path.split("/").filter((p) => p.length > 0 && !p.startsWith("{"));
  return parts.length > 0 ? parts[parts.length - 1] : null;
}
