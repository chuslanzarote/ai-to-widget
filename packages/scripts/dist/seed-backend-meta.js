import { promises as fs } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Debug from "debug";
const log = Debug("atw:seed-backend-meta");
/** Meta files copied verbatim from `packages/backend/` into a Builder's
 * `<project>/backend/`. Keep in sync with contracts/build-manifest-extensions.md. */
const META_FILES = [
    "Dockerfile",
    ".dockerignore",
    "package.json",
    "tsconfig.json",
];
export function defaultBackendPackageDir() {
    const here = fileURLToPath(import.meta.url);
    const pkgScripts = path.resolve(path.dirname(here), "..");
    return path.resolve(pkgScripts, "..", "backend");
}
export async function seedBackendMeta(opts) {
    const src = opts.backendPackageDir ?? defaultBackendPackageDir();
    const destRoot = path.join(opts.projectRoot, "backend");
    await fs.mkdir(destRoot, { recursive: true });
    const results = [];
    for (const name of META_FILES) {
        const srcAbs = path.join(src, name);
        let content;
        try {
            content = await fs.readFile(srcAbs, "utf8");
        }
        catch (err) {
            // tsconfig.json / .dockerignore MAY be optional on legacy checkouts;
            // skip silently if absent in the source tree.
            if (err.code === "ENOENT") {
                log("seed source missing, skipping: %s", srcAbs);
                continue;
            }
            throw err;
        }
        // If the file is the root tsconfig.json with an `extends` pointing at
        // a path that won't exist in the seeded project, inline the base so
        // the shipped config is standalone. Keeps the Dockerfile build green.
        if (name === "tsconfig.json") {
            content = await inlineTsconfigBase(content, src);
        }
        // Normalise line endings for cross-platform determinism.
        const normalised = content.replace(/\r\n/g, "\n");
        const targetAbs = path.join(destRoot, name);
        let prior = null;
        try {
            prior = await fs.readFile(targetAbs, "utf8");
        }
        catch {
            prior = null;
        }
        let action = "created";
        let backup;
        if (prior !== null) {
            if (prior === normalised) {
                action = "unchanged";
            }
            else {
                action = "rewritten";
                if (opts.backup) {
                    backup = targetAbs + ".bak";
                    await fs.writeFile(backup, prior, "utf8");
                }
            }
        }
        if (action !== "unchanged") {
            await fs.writeFile(targetAbs, normalised, "utf8");
        }
        const buf = Buffer.from(normalised, "utf8");
        const sha256 = createHash("sha256").update(buf).digest("hex");
        results.push({
            path: `backend/${name}`,
            sha256,
            bytes: buf.byteLength,
            action,
            backup: backup
                ? path.relative(opts.projectRoot, backup).replace(/\\/g, "/")
                : undefined,
        });
        log("%s -> %s (%s)", srcAbs, targetAbs, action);
    }
    return results;
}
async function inlineTsconfigBase(raw, srcDir) {
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        // If it doesn't parse, ship as-is; Dockerfile build will surface the issue.
        return raw;
    }
    if (!parsed.extends)
        return raw;
    const baseAbs = path.resolve(srcDir, parsed.extends);
    let baseRaw;
    try {
        baseRaw = await fs.readFile(baseAbs, "utf8");
    }
    catch {
        return raw;
    }
    let base;
    try {
        base = JSON.parse(baseRaw);
    }
    catch {
        return raw;
    }
    const merged = {
        compilerOptions: {
            ...(base.compilerOptions ?? {}),
            ...(parsed.compilerOptions ?? {}),
        },
        ...(parsed.include !== undefined ? { include: parsed.include } : {}),
        ...(parsed.exclude !== undefined ? { exclude: parsed.exclude } : {}),
    };
    return JSON.stringify(merged, null, 2) + "\n";
}
//# sourceMappingURL=seed-backend-meta.js.map