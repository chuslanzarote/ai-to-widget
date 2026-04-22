/**
 * Connection-string / credential detector (FR-018 + SC-010).
 *
 * /atw.schema must *refuse* raw DB connection strings or paired
 * `host=...` / `password=...` credentials. This is a guard applied at
 * the script boundary so credentials are rejected *before* any parsing
 * happens — if we parsed a connection string we'd be tacitly accepting
 * that the Builder might have pasted one.
 */
export interface CredentialFindings {
    found: boolean;
    matches: {
        kind: "scheme" | "kv-pair";
        sample: string;
    }[];
}
export declare function detectCredentials(input: string): CredentialFindings;
export declare const REFUSAL_MESSAGE: string;
//# sourceMappingURL=credential-guard.d.ts.map