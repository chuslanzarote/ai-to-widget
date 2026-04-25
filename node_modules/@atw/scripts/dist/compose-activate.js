import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";
const log = Debug("atw:compose-activate");
/**
 * Start and end sentinels emitted by Feature 001 around the commented-out
 * ATW docker-compose block. We uncomment lines strictly between them.
 */
export const BEGIN_MARK = "# ----- atw:begin -----";
export const END_MARK = "# ----- atw:end -----";
const DEFAULT_APPEND_BLOCK = [
    BEGIN_MARK_LITERAL(),
    "  atw_postgres:",
    "    image: pgvector/pgvector:pg16",
    "    environment:",
    "      POSTGRES_USER: atw",
    "      POSTGRES_PASSWORD: atw",
    "      POSTGRES_DB: atw",
    "    ports:",
    "      - \"5433:5432\"",
    "  atw_backend:",
    "    image: atw_backend:latest",
    "    depends_on: [atw_postgres]",
    "    environment:",
    "      DATABASE_URL: postgresql://atw:atw@atw_postgres:5432/atw",
    "      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}",
    "      ALLOWED_ORIGINS: ${ALLOWED_ORIGINS}",
    "    ports:",
    "      - \"3100:3100\"",
    END_MARK_LITERAL(),
].join("\n");
function BEGIN_MARK_LITERAL() { return "# ----- atw:begin -----"; }
function END_MARK_LITERAL() { return "# ----- atw:end -----"; }
export async function composeActivate(composeFile, opts = {}) {
    let raw;
    try {
        raw = await fs.readFile(composeFile, "utf8");
    }
    catch (err) {
        const e = new Error(`compose file not found at ${composeFile}: ${err.message}`);
        e.code = "COMPOSE_NOT_FOUND";
        throw e;
    }
    const lines = raw.split(/\r?\n/);
    const begin = lines.findIndex((l) => l.trim() === BEGIN_MARK);
    const end = lines.findIndex((l) => l.trim() === END_MARK);
    if (begin < 0 || end < 0 || end < begin) {
        // FR-029 / R7 / Q3: ATW MUST NOT modify the host compose without a
        // confirmed `[y/N]`. If no `confirmAppend` was supplied (e.g., legacy
        // caller, non-interactive context) we surface the diff and skip.
        const block = opts.appendBlock ?? DEFAULT_APPEND_BLOCK;
        const proposedDiff = `--- ${path.basename(composeFile)} (no atw markers found)\n+++ append at end of file:\n${block}`;
        const confirmed = opts.confirmAppend
            ? await opts.confirmAppend(proposedDiff).catch(() => false)
            : false;
        if (!confirmed) {
            log("compose markers missing; skipping (no confirmation)");
            return {
                action: "no-markers",
                services: [],
                skipped_reason: "host compose has no atw:begin/atw:end markers and the integrator declined the append prompt",
                proposed_diff: proposedDiff,
            };
        }
        const appended = `${raw.replace(/\n$/, "")}\n\n${block}\n`;
        await fs.writeFile(composeFile, appended, "utf8");
        log("appended marker block to %s", composeFile);
        const appendedServices = new Set();
        for (const l of block.split(/\r?\n/)) {
            const svc = /^\s\s([a-zA-Z0-9_-]+):\s*$/.exec(l);
            if (svc)
                appendedServices.add(svc[1]);
        }
        return { action: "activated", services: Array.from(appendedServices) };
    }
    // Uncomment every line inside the block that starts with "# " (NOT the
    // marker lines themselves). If no lines need changing, we're already
    // active.
    const services = new Set();
    let changed = false;
    for (let i = begin + 1; i < end; i++) {
        const l = lines[i];
        const m = /^(\s*)#\s?(.*)$/.exec(l);
        if (m) {
            const rewritten = `${m[1]}${m[2]}`;
            if (rewritten !== l) {
                lines[i] = rewritten;
                changed = true;
            }
        }
        const svc = /^\s\s([a-zA-Z0-9_-]+):\s*$/.exec(lines[i]);
        if (svc)
            services.add(svc[1]);
    }
    if (changed) {
        const out = lines.join("\n");
        await fs.writeFile(composeFile, out, "utf8");
        log("activated %s (%d services)", composeFile, services.size);
        return { action: "activated", services: Array.from(services) };
    }
    return { action: "unchanged", services: Array.from(services) };
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "compose-file": { type: "string" },
            json: { type: "boolean", default: false },
            help: { type: "boolean", default: false, short: "h" },
            version: { type: "boolean", default: false, short: "v" },
        },
        strict: true,
    });
    if (values.help)
        return { help: true };
    if (values.version)
        return { version: true };
    return {
        composeFile: String(values["compose-file"] ?? path.resolve(process.cwd(), "docker-compose.yml")),
        json: Boolean(values.json),
    };
}
export async function runComposeActivate(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-compose-activate: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-compose-activate [--compose-file <path>] [--json]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-compose-activate 0.1.0\n");
        return 0;
    }
    try {
        const result = await composeActivate(opts.composeFile);
        if (opts.json) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else {
            process.stdout.write(`${result.action} (${result.services.length} services)\n`);
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        if (code === "COMPOSE_NOT_FOUND") {
            process.stderr.write(`atw-compose-activate: ${err.message}\n`);
            return 21;
        }
        process.stderr.write(`atw-compose-activate: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=compose-activate.js.map