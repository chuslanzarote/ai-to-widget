/**
 * Widget configuration resolved from `data-*` attributes on the loader
 * script. Source of truth:
 * specs/003-runtime/contracts/widget-config.md §1.
 */
export type AuthMode = "cookie" | "bearer" | "custom";
export type LauncherPosition = "bottom-right" | "bottom-left" | "bottom-center";

export interface WidgetConfig {
  backendUrl: string;
  apiBaseUrl: string;
  theme: string;
  launcherPosition: LauncherPosition;
  authMode: AuthMode;
  authTokenKey?: string;
  locale: string;
  loginUrl?: string;
  introLine?: string;
  /** Tool names the widget will execute; injected at build time. */
  allowedTools: string[];
  /**
   * Citation URL template. Supports `{entity_type}` and `{entity_id}` (plus
   * any other fields from the Citation object). Default
   * `${apiBaseUrl}/${entity_type}/${entity_id}` is applied if empty — this
   * resolves analysis finding U1 from /speckit.analyze.
   */
  citationUrlTemplate?: string;
}

export interface ConfigIssue {
  key: string;
  message: string;
}

export interface ConfigReadResult {
  ok: boolean;
  config: WidgetConfig;
  issues: ConfigIssue[];
}

const ALLOWED_POSITIONS: LauncherPosition[] = [
  "bottom-right",
  "bottom-left",
  "bottom-center",
];
const ALLOWED_AUTH_MODES: AuthMode[] = ["cookie", "bearer", "custom"];

export function readConfigFromAttributes(
  attrs: DOMStringMap,
  fallbacks?: {
    apiBaseUrl?: string;
    locale?: string;
    allowedTools?: string[];
  },
): ConfigReadResult {
  const issues: ConfigIssue[] = [];
  const backendUrl = attrs.backendUrl ?? "";
  if (!backendUrl) {
    issues.push({
      key: "data-backend-url",
      message: "data-backend-url is required",
    });
  }
  const authMode = normaliseAuthMode(attrs.authMode, issues);
  const authTokenKey = attrs.authTokenKey ?? undefined;
  if (authMode === "bearer" && !authTokenKey) {
    issues.push({
      key: "data-auth-token-key",
      message: "data-auth-token-key is required when data-auth-mode=bearer",
    });
  }
  const launcherPosition = normaliseLauncherPosition(attrs.launcherPosition, issues);
  const config: WidgetConfig = {
    backendUrl,
    apiBaseUrl: attrs.apiBaseUrl ?? fallbacks?.apiBaseUrl ?? "",
    theme: attrs.theme ?? "default",
    launcherPosition,
    authMode,
    authTokenKey,
    locale: attrs.locale ?? fallbacks?.locale ?? "en-US",
    loginUrl: attrs.loginUrl || undefined,
    introLine: attrs.intro || undefined,
    allowedTools: fallbacks?.allowedTools ?? [],
    citationUrlTemplate: attrs.citationUrlTemplate || undefined,
  };
  return { ok: issues.length === 0, config, issues };
}

function normaliseAuthMode(v: string | undefined, issues: ConfigIssue[]): AuthMode {
  if (!v) return "cookie";
  if ((ALLOWED_AUTH_MODES as string[]).includes(v)) return v as AuthMode;
  issues.push({
    key: "data-auth-mode",
    message: `data-auth-mode must be one of ${ALLOWED_AUTH_MODES.join(", ")}; got "${v}"`,
  });
  return "cookie";
}

function normaliseLauncherPosition(
  v: string | undefined,
  issues: ConfigIssue[],
): LauncherPosition {
  if (!v) return "bottom-right";
  if ((ALLOWED_POSITIONS as string[]).includes(v)) return v as LauncherPosition;
  issues.push({
    key: "data-launcher-position",
    message: `data-launcher-position must be one of ${ALLOWED_POSITIONS.join(", ")}; got "${v}"`,
  });
  return "bottom-right";
}

export function resolveCitationHref(
  citation: { entity_type: string; entity_id: string; href?: string },
  config: WidgetConfig,
): string | null {
  if (citation.href) return citation.href;
  const base = config.apiBaseUrl || "";
  const template =
    config.citationUrlTemplate ?? `${base.replace(/\/$/, "")}/{entity_type}/{entity_id}`;
  return template
    .replace(/\{entity_type\}/g, encodeURIComponent(citation.entity_type))
    .replace(/\{entity_id\}/g, encodeURIComponent(citation.entity_id));
}
