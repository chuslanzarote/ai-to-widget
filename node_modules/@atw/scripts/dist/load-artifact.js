import { parseArgs } from "node:util";
import path from "node:path";
import { exists } from "./lib/atomic.js";
import { readMarkdown, parseArtifactFromMarkdown } from "./lib/markdown.js";
import { ArtifactKindSchema } from "./lib/types.js";
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            kind: { type: "string" },
            source: { type: "string" },
        },
        strict: true,
    });
    if (!values.kind)
        throw new Error("--kind <project|brief|schema-map|action-manifest|build-plan> is required");
    if (!values.source)
        throw new Error("--source <path> is required");
    const kind = ArtifactKindSchema.parse(values.kind);
    return { kind, source: values.source };
}
export async function loadArtifactFromFile(kind, sourcePath) {
    const parsed = await readMarkdown(sourcePath);
    const content = parseArtifactFromMarkdown(kind, parsed);
    return { kind, path: sourcePath, content };
}
export async function runLoadArtifact(argv) {
    let cli;
    try {
        cli = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-load-artifact: ${err.message}\n`);
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
    }
    catch (err) {
        process.stderr.write(`atw-load-artifact: malformed ${cli.kind} artifact: ${err.message}\n`);
        return 2;
    }
}
//# sourceMappingURL=load-artifact.js.map