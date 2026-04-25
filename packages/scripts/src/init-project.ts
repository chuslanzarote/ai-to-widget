import { promises as fs } from "node:fs";
import path from "node:path";
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

export interface InitProjectAnswers {
  name: string;
  languages: string[];
  deploymentType: ProjectArtifact["deploymentType"];
  /** Feature 008 / T044 — prompts default this to `["http://localhost:5173"]`
   * when `deploymentType === "customer-facing-widget"`. */
  storefrontOrigins?: string[];
  welcomeMessage?: string;
  authTokenKey?: string;
  loginUrl?: string;
}

export interface InitProjectOptions {
  answers: InitProjectAnswers;
  targetPath: string;
  now?: () => Date;
}

/**
 * Feature 008 / T045 — a single frontmatter field that differs between
 * the prior artifact and the newly-captured answers. Surfaced as the
 * `diff` array on {@link InitProjectResult} so `/atw.init` can show a
 * human-readable before/after before the atomic write.
 */
export interface ProjectFieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface InitProjectResult {
  artifact: ProjectArtifact;
  wrote: boolean;
  targetPath: string;
  /** The pre-existing artifact, or `null` on a first run. */
  previous: ProjectArtifact | null;
  /**
   * Per-field diff vs. `previous` (empty on first run AND on no-op re-runs
   * where every captured value matches). `updatedAt` is excluded — it
   * always changes, so listing it adds noise.
   */
  diff: ProjectFieldDiff[];
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
 * Feature 008 / T045 — compute the per-field diff between two project
 * artifacts, ignoring `updatedAt`. Used by `/atw.init` to render the
 * confirmation-gate diff and by `initProject` to decide whether the
 * captured answers actually changed anything.
 */
export function diffProjects(
  before: ProjectArtifact,
  after: ProjectArtifact,
): ProjectFieldDiff[] {
  const fields: Array<keyof ProjectArtifact> = [
    "name",
    "languages",
    "deploymentType",
    "createdAt",
    "storefrontOrigins",
    "welcomeMessage",
    "authTokenKey",
    "loginUrl",
  ];
  const out: ProjectFieldDiff[] = [];
  for (const f of fields) {
    const a = before[f];
    const b = after[f];
    if (!deepEqual(a, b)) {
      out.push({ field: String(f), before: a, after: b });
    }
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  return false;
}

export async function initProject(opts: InitProjectOptions): Promise<InitProjectResult> {
  const { answers, targetPath } = opts;

  const deployment = DeploymentTypeSchema.parse(answers.deploymentType);
  const languages = answers.languages.map((l) => l.trim()).filter((l) => l.length > 0);
  if (languages.length === 0) {
    throw new Error("initProject: at least one language is required.");
  }

  const existing = await loadExistingProject(targetPath);
  const nowIso = (opts.now ? opts.now() : new Date()).toISOString();
  const createdAt = existing?.createdAt ?? nowIso;

  // Feature 008 / T006 — when deploymentType is customer-facing-widget the
  // ProjectArtifact refine requires a non-empty storefrontOrigins. Prefer
  // the caller-supplied answer, then the previously-captured value, then a
  // sane default so first-run non-interactive callers still validate.
  const storefrontOrigins =
    answers.storefrontOrigins && answers.storefrontOrigins.length > 0
      ? answers.storefrontOrigins
      : existing?.storefrontOrigins && existing.storefrontOrigins.length > 0
        ? existing.storefrontOrigins
        : deployment === "customer-facing-widget"
          ? ["http://localhost:5173"]
          : undefined;

  const welcomeMessage =
    answers.welcomeMessage ?? existing?.welcomeMessage;
  const authTokenKey = answers.authTokenKey ?? existing?.authTokenKey;
  const loginUrl =
    answers.loginUrl !== undefined ? answers.loginUrl : existing?.loginUrl;

  // Build the "ignoring updatedAt" candidate first so the diff reflects
  // only Builder-visible changes (FR-005a / contracts/project-md-v2.md
  // §Re-run behaviour).
  const candidateCore: Omit<ProjectArtifact, "updatedAt"> = {
    name: answers.name.trim(),
    languages,
    deploymentType: deployment,
    createdAt,
    ...(storefrontOrigins ? { storefrontOrigins } : {}),
    ...(welcomeMessage !== undefined ? { welcomeMessage } : {}),
    ...(authTokenKey !== undefined ? { authTokenKey } : {}),
    ...(loginUrl !== undefined ? { loginUrl } : {}),
  };

  const diff = existing ? diffProjects(existing, candidateCore as ProjectArtifact) : [];

  // Per contracts/project-md-v2.md test 3: re-running `/atw.init` without
  // changing any answer yields byte-identical frontmatter **except**
  // `updatedAt`. So every write on a pre-existing artifact bumps
  // `updatedAt`; first-run writes also stamp it so downstream consumers
  // never see a missing value.
  const candidate: ProjectArtifact = ProjectArtifactSchema.parse({
    ...candidateCore,
    updatedAt: nowIso,
  });

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const markdown = serializeArtifact("project", candidate);
  await writeArtifactAtomic(targetPath, markdown);
  return {
    artifact: candidate,
    wrote: true,
    targetPath,
    previous: existing,
    diff,
  };
}
