/**
 * Feature 008 — Builder-facing diagnostic text emitters.
 *
 * Every string emitted here mirrors a bullet in
 * `specs/008-atw-hardening/contracts/builder-diagnostics.md` byte-for-byte
 * (modulo interpolated identifiers). Keeping the formatters co-located
 * makes T055's regression test a single-import job and prevents silent
 * drift between the orchestrator, validator, classifier, and widget.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
/**
 * Compose D-SQLDUMP. When `.atw/inputs/README.md` already exists (because
 * `/atw.schema` captured the exact invocation earlier), emit the short
 * variant that points at the README. Otherwise emit the full `pg_dump`
 * command with whatever connection fields are known.
 */
export async function formatSqlDumpHalt(ctx) {
    const readmePath = path.join(ctx.projectRoot, ".atw", "inputs", "README.md");
    const hasReadme = await fileExists(readmePath);
    const header = `ERROR: .atw/inputs/${ctx.name}.sql is missing.`;
    if (hasReadme) {
        return [
            header,
            "",
            "Run the command captured in .atw/inputs/README.md to produce it.",
            "",
        ].join("\n");
    }
    const host = ctx.host ?? "<detected host>";
    const port = ctx.port !== undefined ? String(ctx.port) : "<detected port>";
    const user = ctx.user ?? "<detected user>";
    const db = ctx.database ?? "<detected db>";
    return [
        header,
        "",
        "Run this command to produce it:",
        "",
        "  pg_dump \\",
        `    --host=${host} \\`,
        `    --port=${port} \\`,
        `    --username=${user} \\`,
        `    --dbname=${db} \\`,
        "    --schema-only \\",
        "    --no-owner --no-privileges \\",
        `    > .atw/inputs/${ctx.name}.sql`,
        "",
        "Connection details are derived from your project config. See .atw/inputs/README.md",
        "for the exact invocation already captured during /atw.schema.",
        "",
    ].join("\n");
}
async function fileExists(p) {
    try {
        await fs.access(p);
        return true;
    }
    catch {
        return false;
    }
}
export class MissingSqlDumpError extends Error {
    code = "MISSING_SQL_DUMP";
    constructor(message) {
        super(message);
        this.name = "MissingSqlDumpError";
    }
}
//# sourceMappingURL=diagnostics.js.map