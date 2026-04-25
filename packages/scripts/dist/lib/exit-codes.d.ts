/**
 * Feature 005 — stable exit-code map shared by every pipeline CLI wrapper.
 * Mapping mirrors `specs/005-full-reviewer-path/contracts/orchestrator-cli.md`.
 *
 * Feature 006 extension — every new error class introduced by the
 * OpenAPI-driven action catalog also maps to process exit 1. The named
 * codes exist so the orchestrator can tag `pipeline_failures[*].code`
 * deterministically and so tests can assert the error class by its
 * `.code` property without string-matching human-readable messages.
 * Contracts: atw-api-command.md §3, classifier-contract.md §7,
 * action-manifest.schema.md §10.
 */
export declare const EXIT_GENERIC = 1;
export declare const EXIT_ENV = 3;
export declare const EXIT_TEMPLATE_COMPILE = 17;
export declare const EXIT_DOCKER_BUILD = 19;
export declare const EXIT_SECRET_IN_CONTEXT = 20;
export declare const EXIT_CODE_BY_ERROR_CODE: Record<string, number>;
export declare function exitCodeForErrorCode(code: string | undefined): number;
//# sourceMappingURL=exit-codes.d.ts.map