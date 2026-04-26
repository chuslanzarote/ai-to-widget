/**
 * Feature 008 / T055 / FR-022 / FR-023 — widget-visible diagnostic text.
 *
 * Every string returned here mirrors a bullet in
 * `specs/008-atw-hardening/contracts/builder-diagnostics.md` byte-for-byte
 * (modulo the interpolated `<toolName>`). Keeping the formatters in one
 * module makes the T055 text-exactness test a single import.
 */

/** D-TOOLNOTALLOWED (FR-022). */
export function renderToolNotAllowedDiagnostic(toolName: string): string {
  return (
    `This conversation tried to use tool "${toolName}" which is not in the widget's\n` +
    `allow-list. Ask the Builder to include this tool in /atw.embed's data-allowed-tools.`
  );
}

/** D-NOEXECUTORS (FR-023). */
export function renderNoExecutorsDiagnostic(toolName: string): string {
  return (
    `The widget's action catalog is missing or empty, so tool "${toolName}" cannot run.\n` +
    "Ask the Builder to copy `.atw/artifacts/action-executors.json` into the host's\n" +
    "public assets (see /atw.embed output)."
  );
}
