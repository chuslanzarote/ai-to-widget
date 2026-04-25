import { z } from "zod";
/**
 * Feature 008 / T007 — `atw-hash-inputs` reader/writer shape aligned with
 * `lib/input-hashes.ts` writer (research R14 / FR-006). On-disk shape:
 *
 *   {
 *     "schema_version": "1",
 *     "files": { "<relativePath>": "sha256:<hex>" | "<hex>", ... },
 *     "prompt_template_version": "<string>"
 *   }
 *
 * `sha256:<hex>` prefix is accepted on read (emitted by
 * `lib/input-hashes.ts#sha256File`) and on write (this CLI) for
 * round-trip fidelity with the main build pipeline.
 */
export declare const HashInputsStateSchema: z.ZodObject<{
    schema_version: z.ZodLiteral<"1">;
    files: z.ZodRecord<z.ZodString, z.ZodString>;
    prompt_template_version: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    schema_version: "1";
    files: Record<string, string>;
    prompt_template_version: string;
}, {
    schema_version: "1";
    files: Record<string, string>;
    prompt_template_version?: string | undefined;
}>;
export type HashInputsState = z.infer<typeof HashInputsStateSchema>;
/** Kept for backward-compat with pre-008 consumers (classifyKind result). */
export type InputHashKind = "sql-dump" | "openapi" | "brief-input" | "other";
export interface HashResult {
    path: string;
    sha256: string;
    previousSha256: string | null;
    changed: boolean;
    kind: InputHashKind;
}
export declare function hashFile(filePath: string): Promise<string>;
/**
 * D-HASHMISMATCH (FR-006) — emitted on read when the on-disk file does
 * not match the aligned schema.
 */
export declare class HashIndexSchemaMismatchError extends Error {
    readonly actualShape: string;
    constructor(actualShape: string);
}
export declare function loadState(statePath: string): Promise<HashInputsState | null>;
export declare function computeHashResults(opts: {
    rootDir: string;
    inputs: string[];
    previous: HashInputsState | null;
}): Promise<HashResult[]>;
export declare function writeState(statePath: string, results: HashResult[], opts?: {
    promptTemplateVersion?: string;
    existing?: HashInputsState | null;
}): Promise<void>;
/**
 * D-INPUTSARGS (FR-007 / R15) — positional parser for `--inputs`.
 * Accepted forms:
 *   - `--inputs a.md b.md c.md` (whitespace-separated, terminated by next `--flag` or end)
 *   - `--inputs a.md,b.md,c.md` (legacy comma form, single argv entry)
 *   - `--inputs a.md` (single file)
 */
export declare function parseInputsPositional(argv: string[]): {
    root: string | null;
    inputs: string[];
    updateState: boolean;
    verbose: boolean;
    promptTemplateVersion: string;
};
export declare function runHashInputs(argv: string[]): Promise<number>;
//# sourceMappingURL=hash-inputs.d.ts.map