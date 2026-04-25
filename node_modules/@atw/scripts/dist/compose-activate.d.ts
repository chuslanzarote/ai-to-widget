export type ComposeActivateAction = "activated" | "unchanged" | "skipped" | "no-markers";
export interface ComposeActivateResult {
    action: ComposeActivateAction;
    services: string[];
    /** Populated when `action === "skipped"` or `"no-markers"` (FR-029). */
    skipped_reason?: string;
    /** Diff that would have been applied; surfaced on skip so the integrator
     *  can paste the exact block themselves. */
    proposed_diff?: string;
}
/**
 * Start and end sentinels emitted by Feature 001 around the commented-out
 * ATW docker-compose block. We uncomment lines strictly between them.
 */
export declare const BEGIN_MARK = "# ----- atw:begin -----";
export declare const END_MARK = "# ----- atw:end -----";
export interface ComposeActivateOptions {
    /**
     * FR-029, R7, Q3. When the host compose file has no atw:begin/atw:end
     * markers, the orchestrator MAY append the marker block — but only after
     * the integrator confirms `[y/N]`. The CLI passes a confirm function
     * that surfaces the prompt; tests pass an explicit boolean. ATW MUST
     * NOT modify the host compose without explicit confirmation.
     */
    confirmAppend?: (proposedDiff: string) => Promise<boolean>;
    /**
     * Optional compose-block snippet to append when markers are missing and
     * confirmation is granted. Defaults to a minimal pgvector + atw_backend
     * stanza wrapped in markers.
     */
    appendBlock?: string;
}
export declare function composeActivate(composeFile: string, opts?: ComposeActivateOptions): Promise<ComposeActivateResult>;
export declare function runComposeActivate(argv: string[]): Promise<number>;
//# sourceMappingURL=compose-activate.d.ts.map