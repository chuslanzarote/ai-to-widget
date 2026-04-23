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
export const EXIT_GENERIC = 1;
export const EXIT_ENV = 3;
export const EXIT_TEMPLATE_COMPILE = 17;
export const EXIT_DOCKER_BUILD = 19;
export const EXIT_SECRET_IN_CONTEXT = 20;

export const EXIT_CODE_BY_ERROR_CODE: Record<string, number> = {
  TEMPLATE_COMPILE: EXIT_TEMPLATE_COMPILE,
  VENDOR_IMPORT_UNRESOLVED: EXIT_TEMPLATE_COMPILE,
  DOCKER_UNREACHABLE: EXIT_ENV,
  DOCKER_BUILD: EXIT_DOCKER_BUILD,
  SECRET_IN_CONTEXT: EXIT_SECRET_IN_CONTEXT,

  // Feature 006 — OpenAPI ingestion
  SWAGGER_20_DETECTED: EXIT_GENERIC,
  DUPLICATE_OPERATION_ID: EXIT_GENERIC,
  FETCH_FAILED: EXIT_GENERIC,

  // Feature 006 — classifier & manifest
  ANCHORED_GENERATION_VIOLATION: EXIT_GENERIC,
  OPUS_RESPONSE_INVALID: EXIT_GENERIC,
  CLASSIFIER_TIMEOUT: EXIT_GENERIC,
  MANIFEST_VALIDATION: EXIT_GENERIC,
  TOOL_NAME_COLLISION: EXIT_GENERIC,
};

export function exitCodeForErrorCode(code: string | undefined): number {
  if (!code) return EXIT_GENERIC;
  return EXIT_CODE_BY_ERROR_CODE[code] ?? EXIT_GENERIC;
}
