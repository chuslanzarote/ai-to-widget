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

  if (existing && shallowEqualProject(existing, candidate)) {
    return { artifact: candidate, wrote: false, targetPath };
  }

  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  const markdown = serializeArtifact("project", candidate);
  await writeArtifactAtomic(targetPath, markdown);
  return { artifact: candidate, wrote: true, targetPath };
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
