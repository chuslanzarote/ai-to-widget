import { parseArgs } from "node:util";
import path from "node:path";
import { exists } from "./lib/atomic.js";
import { readMarkdown, parseArtifactFromMarkdown } from "./lib/markdown.js";
import type { ArtifactKind, LoadedArtifact } from "./lib/types.js";
import { ArtifactKindSchema } from "./lib/types.js";

interface CliOptions {
  kind: ArtifactKind;
  source: string;
}

function parseCli(argv: string[]): CliOptions {
  const { values } = parseArgs({
    args: argv,
    options: {
      kind: { type: "string" },
      source: { type: "string" },
    },
    strict: true,
  });
  if (!values.kind) throw new Error("--kind <project|brief|schema-map|action-manifest|build-plan> is required");
  if (!values.source) throw new Error("--source <path> is required");
  const kind = ArtifactKindSchema.parse(values.kind);
  return { kind, source: values.source as string };
}

export async function loadArtifactFromFile<K extends ArtifactKind>(
  kind: K,
  sourcePath: string,
): Promise<LoadedArtifact> {
  const parsed = await readMarkdown(sourcePath);
  const content = parseArtifactFromMarkdown(kind, parsed);
  return { kind, path: sourcePath, content } as LoadedArtifact;
}

export async function runLoadArtifact(argv: string[]): Promise<number> {
  let cli: CliOptions;
  try {
    cli = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-load-artifact: ${(err as Error).message}\n`);
    return 3;
  }

  const resolved = path.resolve(cli.source);
  if (!(await exists(resolved))) {
    process.stderr.write(`atw-load-artifact: file not found: ${resolved}\n`);
    return 1;
  }

  try {
    const loaded = await loadArtifactFromFile(cli.kind, resolved);
    process.stdout.write(JSON.stringify(loaded, null, 2) + "\n");
    return 0;
  } catch (err) {
    process.stderr.write(`atw-load-artifact: malformed ${cli.kind} artifact: ${(err as Error).message}\n`);
    return 2;
  }
}
