/**
 * Feature 007 — declarative credential resolver.
 *
 * The action-executors catalog ships a `credentialSource` block per
 * authenticated operation. This module turns that declaration into a
 * concrete HTTP header the widget can stamp on an outgoing request.
 *
 * Contract: specs/007-widget-tool-loop/contracts/action-catalog-v2.md
 * §Engine behaviour.
 *
 * Fail-closed posture (FR-021): unknown `type` values throw at call
 * time. The Zod schema already rejects unknown variants at catalog
 * load, so in practice this branch fires only if the catalog types
 * drift away from the runtime resolver.
 */
import type { CredentialSource } from "@atw/scripts/dist/lib/action-executors-types.js";

export interface ResolvedCredential {
  header: string;
  value: string;
}

export class UnknownCredentialSourceError extends Error {
  readonly code = "ATW_UNKNOWN_CREDENTIAL_SOURCE" as const;
  constructor(public readonly type: string) {
    super(`Unknown credentialSource type "${type}" — catalog rejected.`);
  }
}

export function resolveCredential(
  source: CredentialSource,
): ResolvedCredential | null {
  switch (source.type) {
    case "bearer-localstorage": {
      const raw =
        typeof window !== "undefined" && window.localStorage
          ? window.localStorage.getItem(source.key)
          : null;
      if (!raw || raw.length === 0) return null;
      return {
        header: source.header,
        value: `${source.scheme} ${raw}`,
      };
    }
    default: {
      // TypeScript will flag this as unreachable once the union grows;
      // runtime guard is kept for fail-closed behaviour on drift.
      const t = (source as { type: string }).type;
      throw new UnknownCredentialSourceError(t);
    }
  }
}
