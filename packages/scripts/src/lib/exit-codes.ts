/**
 * Feature 005 — stable exit-code map shared by every pipeline CLI wrapper.
 * Mapping mirrors `specs/005-full-reviewer-path/contracts/orchestrator-cli.md`.
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
};

export function exitCodeForErrorCode(code: string | undefined): number {
  if (!code) return EXIT_GENERIC;
  return EXIT_CODE_BY_ERROR_CODE[code] ?? EXIT_GENERIC;
}
