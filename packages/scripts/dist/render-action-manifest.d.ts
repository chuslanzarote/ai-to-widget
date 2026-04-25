/**
 * Feature 006 — Serialise an `ActionManifest` back to markdown per
 * contracts/action-manifest.schema.md.
 *
 * Round-trip invariant (tested in parse-action-manifest.unit.test.ts):
 *   renderActionManifest(parseActionManifestText(text)) === text
 * for any canonical input produced by this function.
 *
 * Ordering rules:
 *   - Groups sorted alphabetically.
 *   - Tools within a group sorted alphabetically by toolName.
 *   - Excluded sorted by path, then method.
 */
import type { ActionManifest, ActionManifestEntry } from "./lib/action-manifest-types.js";
export interface RenderActionManifestOptions {
    /** Override the `## Tools: <group>` bucket for each entry. Default: infer from path. */
    groupFor?: (entry: ActionManifestEntry) => string;
    /** Append a carried-over runtime system prompt block from brief.md. */
    runtimeSystemPromptBlock?: string;
}
/**
 * Render an `ActionManifest` to canonical markdown bytes. LF line
 * endings, trailing newline at EOF.
 */
export declare function renderActionManifest(manifest: ActionManifest, opts?: RenderActionManifestOptions): string;
//# sourceMappingURL=render-action-manifest.d.ts.map