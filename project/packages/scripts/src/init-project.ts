import { promises as fs } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { writeArtifactAtomic } from "./lib/atomic.js";
import {
  parseArtifactFromMarkdown,
  parseMarkdown,
  serializeArtifact,
} from "./lib/markdown.js";
import {
  DeploymentTypeSchema,
  ProjectArtifactSchema,
  type ProjectArtifact,
} from "./lib/types.js";
import {
  ProjectConfigSchema,
  checkProjectConfigInvariants,
  type ProjectConfig,
} from "./lib/schemas/project-md.js";
import { isSupportedSnapshot, SUPPORTED_MODEL_SNAPSHOTS } from "./lib/pricing.js";

/**
 * Feature 009 (FR-009, FR-010, FR-011, R6) extends `/atw.init` with the
 * four origins every downstream phase consumes plus a pinned `model_snapshot`.
 * The slash-command markdown drives the prompts; this module owns:
 *   - the answer shape,
 *   - the URL / snapshot validators the slash command calls between turns,
 *   - the optional HEAD probe,
 *   - the strong post-write zod gate against the Feature 009 contract,
 *   - the serialized frontmatter (legacy keys + new keys, both written so
 *     legacy readers and `loadProjectConfig` see the same file).
 */

export interface InitProjectAnswers {
  name: string;
  languages: string[];
  deploymentType: ProjectArtifact["deploymentType"];
  /** Required when deploymentType === "customer-facing-widget" (FR-009). */
  atwBackendOrigin?: string;
  hostApiOrigin?: string;
  hostPageOrigin?: string;
  /** Optional in any deployment. */
  loginUrl?: string;
  /** Pinned LLM snapshot for downstream phases (FR-006, R6). */
  modelSnapshot?: string;
}

export interface InitProjectOptions {
  answers: InitProjectAnswers;
  targetPath: string;
  now?: () => Date;
}

export interface InitProjectResult {
  artifact: ProjectArtifact;
  wrote: boolean;
  targetPath: string;
}

export async function loadExistingProject(
  targetPath: string,
): Promise<ProjectArtifact | null> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    return parseArtifactFromMarkdown("project", parseMarkdown(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Validate a single origin string against the http(s) URL contract enforced
 * by `ProjectConfigSchema`. The slash command calls this between turns to
 * surface the FR-010 "that doesn't look like a URL" message before
 * proceeding to the next question.
 */
export interface UrlValidationResult {
  ok: boolean;
  /** When ok=false, a short integrator-facing message. */
  error?: string;
  /** Parsed URL when ok=true, for the optional HEAD probe step. */
  url?: URL;
}

export function validateOriginUrl(value: string): UrlValidationResult {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { ok: false, error: "value is empty" };
  }
  // Catch the `http//localhost:3200` typo from spec acceptance scenario 2:
  // a string with a host but no `://` separator parses as a relative URL in
  // some Node versions; reject explicitly.
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)) {
    return {
      ok: false,
      error: "missing scheme (did you mean http://… or https://…?)",
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "not a valid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: `unsupported scheme ${parsed.protocol}` };
  }
  return { ok: true, url: parsed };
}

/**
 * Optional HEAD probe (FR-010 SHOULD). Never blocks the init flow — the
 * slash command just surfaces the warning. Times out at 2 s so an
 * unresponsive demo server doesn't stall onboarding.
 */
export interface OriginProbeResult {
  reachable: boolean;
  status?: number;
  error?: string;
}

export async function probeOrigin(
  url: string,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<OriginProbeResult> {
  const validation = validateOriginUrl(url);
  if (!validation.ok) {
    return { reachable: false, error: validation.error };
  }
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    return { reachable: false, error: "fetch unavailable in this runtime" };
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), opts.timeoutMs ?? 2000);
  try {
    const res = await fetchImpl(url, { method: "HEAD", signal: ac.signal });
    return { reachable: true, status: res.status };
  } catch (err) {
    return { reachable: false, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

export function validateModelSnapshot(value: string): UrlValidationResult {
  if (!value || value.trim().length === 0) {
    return { ok: false, error: "value is empty" };
  }
  if (!isSupportedSnapshot(value.trim())) {
    return {
      ok: false,
      error: `unsupported snapshot — choose one of: ${SUPPORTED_MODEL_SNAPSHOTS.join(", ")}`,
    };
  }
  return { ok: true };
}

/**
 * Map the legacy `deploymentType` enum to the Feature 009 `deployment`
 * enum used by `ProjectConfigSchema`. The two were intentionally
 * misaligned across feature cycles; this is the single point of truth.
 */
function deploymentToFeature009(
  deploymentType: ProjectArtifact["deploymentType"],
): ProjectConfig["deployment"] {
  switch (deploymentType) {
    case "customer-facing-widget":
      return "customer-facing-widget";
    case "internal-copilot":
      return "internal-tool";
    case "custom":
      return "headless";
  }
}

export async function initProject(opts: InitProjectOptions): Promise<InitProjectResult> {
  const { answers, targetPath } = opts;

  const deployment = DeploymentTypeSchema.parse(answers.deploymentType);
  const languages = answers.languages.map((l) => l.trim()).filter((l) => l.length > 0);
  if (languages.length === 0) {
    throw new Error("initProject: at least one language is required.");
  }

  const existing = await loadExistingProject(targetPath);
  const createdAt =
    existing?.createdAt ?? (opts.now ? opts.now() : new Date()).toISOString();

  const candidate: ProjectArtifact = ProjectArtifactSchema.parse({
    name: answers.name.trim(),
    languages,
    deploymentType: deployment,
    createdAt,
  });

  // FR-011 zod gate: when the deployment requires the new origin set
  // (customer-facing-widget), validate the assembled Feature 009 frontmatter
  // through `ProjectConfigSchema` BEFORE writing. Surface field-level paths
  // so the slash command can re-prompt the precise question that failed.
  if (deployment === "customer-facing-widget") {
    const f009 = {
      project_name: candidate.name,
      deployment: deploymentToFeature009(deployment),
      atw_backend_origin: answers.atwBackendOrigin,
      host_api_origin: answers.hostApiOrigin,
      host_page_origin: answers.hostPageOrigin,
      ...(answers.loginUrl ? { login_url: answers.loginUrl } : {}),
      model_snapshot: answers.modelSnapshot ?? "claude-opus-4-7",
    };
    const parsed = ProjectConfigSchema.safeParse(f009);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
        .join("; ");
      throw new Error(`initProject: project.md validation failed — ${issues}`);
    }
    const invariantIssues = checkProjectConfigInvariants(parsed.data);
    if (invariantIssues.length > 0) {
      const msg = invariantIssues.map((i) => `${i.path}: ${i.message}`).join("; ");
      throw new Error(`initProject: project.md invariants failed — ${msg}`);
    }
  }

  if (existing && shallowEqualProject(existing, candidate)) {
    // Even when the legacy 4 fields match, the integrator may have provided
    // new origin/snapshot answers that diverge from what's on disk. Detect
    // that by reading the existing frontmatter and comparing.
    const existingExtras = await readExistingExtras(targetPath);
    const desiredExtras = buildExtraFrontmatter(answers, deployment);
    if (extrasEqual(existingExtras, desiredExtras)) {
      return { artifact: candidate, wrote: false, targetPath };
    }
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const markdown = mergeProjectFrontmatter(
    serializeArtifact("project", candidate),
    buildExtraFrontmatter(answers, deployment),
  );
  await writeArtifactAtomic(targetPath, markdown);
  return { artifact: candidate, wrote: true, targetPath };
}

function buildExtraFrontmatter(
  answers: InitProjectAnswers,
  deployment: ProjectArtifact["deploymentType"],
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    project_name: answers.name.trim(),
    deployment: deploymentToFeature009(deployment),
    model_snapshot: answers.modelSnapshot ?? "claude-opus-4-7",
  };
  if (deployment === "customer-facing-widget") {
    if (answers.atwBackendOrigin) out.atw_backend_origin = answers.atwBackendOrigin;
    if (answers.hostApiOrigin) out.host_api_origin = answers.hostApiOrigin;
    if (answers.hostPageOrigin) out.host_page_origin = answers.hostPageOrigin;
  }
  if (answers.loginUrl) out.login_url = answers.loginUrl;
  return out;
}

/**
 * Layer the Feature 009 frontmatter keys on top of the legacy
 * `serializeArtifact("project", ...)` output without dropping the
 * existing prose body. gray-matter round-trip preserves the body text.
 */
function mergeProjectFrontmatter(
  legacyMarkdown: string,
  extras: Record<string, unknown>,
): string {
  const parsed = matter(legacyMarkdown);
  const merged = { ...(parsed.data as Record<string, unknown>), ...extras };
  return matter.stringify(parsed.content, merged);
}

async function readExistingExtras(targetPath: string): Promise<Record<string, unknown>> {
  try {
    const raw = await fs.readFile(targetPath, "utf8");
    const parsed = matter(raw);
    const fm = (parsed.data ?? {}) as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of [
      "project_name",
      "deployment",
      "atw_backend_origin",
      "host_api_origin",
      "host_page_origin",
      "login_url",
      "model_snapshot",
    ]) {
      if (k in fm) out[k] = fm[k];
    }
    return out;
  } catch {
    return {};
  }
}

function extrasEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function shallowEqualProject(a: ProjectArtifact, b: ProjectArtifact): boolean {
  return (
    a.name === b.name &&
    a.deploymentType === b.deploymentType &&
    a.createdAt === b.createdAt &&
    a.languages.length === b.languages.length &&
    a.languages.every((v, i) => v === b.languages[i])
  );
}
