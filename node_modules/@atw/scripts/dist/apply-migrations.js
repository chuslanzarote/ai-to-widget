import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { parseArgs } from "node:util";
import Debug from "debug";
const log = Debug("atw:apply-migrations");
/**
 * Default migrations directory. Resolves relative to this file so it works
 * whether we're running from TS sources or from the compiled `dist/`.
 */
export function defaultMigrationsDir() {
    const here = fileURLToPath(import.meta.url);
    return path.resolve(path.dirname(here), "migrations");
}
export async function loadMigrations(dir) {
    const entries = await fs.readdir(dir);
    const files = entries.filter((f) => f.endsWith(".sql")).sort();
    const out = [];
    for (const filename of files) {
        const abspath = path.join(dir, filename);
        const sql = await fs.readFile(abspath, "utf8");
        const sha256 = createHash("sha256").update(sql).digest("hex");
        out.push({ filename, abspath, sha256, sql });
    }
    return out;
}
export async function applyMigrations(opts) {
    const { Client } = await import("pg");
    const dir = opts.migrationsDir ?? defaultMigrationsDir();
    const files = await loadMigrations(dir);
    const client = new Client(opts.connectionConfig);
    await client.connect();
    try {
        // Ensure the ledger table exists before we consult it. 001_init.sql
        // creates it, but creating it here idempotently avoids a chicken-egg
        // problem on dry-run or when the ledger is itself the first migration.
        await client.query(`
      CREATE TABLE IF NOT EXISTS atw_migrations (
        id          serial primary key,
        filename    text unique not null,
        sha256      text not null,
        applied_at  timestamptz not null default now()
      )
    `);
        const appliedRows = await client.query("SELECT filename, sha256 FROM atw_migrations ORDER BY id");
        const appliedByName = new Map(appliedRows.rows.map((r) => [r.filename, r.sha256]));
        const applied = [];
        const skipped = [];
        const failed = [];
        for (const m of files) {
            const base = m.filename.replace(/\.sql$/, "");
            const priorSha = appliedByName.get(m.filename);
            if (priorSha !== undefined) {
                if (priorSha !== m.sha256) {
                    // Edited file — per contracts/scripts.md §2 exit 5.
                    const e = new Error(`Migration ${m.filename} was modified after apply (sha mismatch)`);
                    e.code = "MIGRATION_EDITED";
                    throw e;
                }
                log("skip %s (already applied)", m.filename);
                skipped.push(base);
                continue;
            }
            if (opts.dryRun) {
                log("dry-run: would apply %s", m.filename);
                applied.push(base);
                continue;
            }
            log("applying %s", m.filename);
            try {
                await client.query("BEGIN");
                await client.query(m.sql);
                await client.query("INSERT INTO atw_migrations (filename, sha256) VALUES ($1, $2)", [m.filename, m.sha256]);
                await client.query("COMMIT");
                applied.push(base);
            }
            catch (err) {
                try {
                    await client.query("ROLLBACK");
                }
                catch {
                    // ignore
                }
                failed.push(base);
                const e = new Error(`Migration ${m.filename} failed: ${err.message}`);
                e.code = "MIGRATION_FAILED";
                e.cause = err;
                throw e;
            }
        }
        return { applied, skipped, failed };
    }
    finally {
        await client.end().catch(() => void 0);
    }
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "dry-run": { type: "boolean", default: false },
            json: { type: "boolean", default: false },
            host: { type: "string" },
            port: { type: "string" },
            user: { type: "string" },
            password: { type: "string" },
            database: { type: "string" },
            "migrations-dir": { type: "string" },
            help: { type: "boolean", default: false, short: "h" },
            version: { type: "boolean", default: false, short: "v" },
        },
        strict: true,
    });
    if (values.help)
        return { help: true };
    if (values.version)
        return { version: true };
    const port = values.port ? Number.parseInt(String(values.port), 10) : 5433;
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error("--port requires an integer in 1..65535");
    }
    return {
        dryRun: Boolean(values["dry-run"]),
        json: Boolean(values.json),
        host: String(values.host ?? "127.0.0.1"),
        port,
        user: String(values.user ?? "atw"),
        password: String(values.password ?? "atw"),
        database: String(values.database ?? "atw"),
        migrationsDir: values["migrations-dir"] ? String(values["migrations-dir"]) : undefined,
    };
}
export async function runApplyMigrations(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-apply-migrations: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-apply-migrations [--dry-run] [--json] [--host ...] [--port ...] [--user ...] [--password ...] [--database ...]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-apply-migrations 0.1.0\n");
        return 0;
    }
    try {
        const result = await applyMigrations({
            dryRun: opts.dryRun,
            connectionConfig: {
                host: opts.host,
                port: opts.port,
                user: opts.user,
                password: opts.password,
                database: opts.database,
            },
            migrationsDir: opts.migrationsDir,
        });
        if (opts.json) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else {
            process.stdout.write(`applied=${result.applied.length} skipped=${result.skipped.length} failed=${result.failed.length}\n`);
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        if (code === "MIGRATION_EDITED") {
            process.stderr.write(`atw-apply-migrations: ${err.message}\n`);
            return 5;
        }
        if (code === "MIGRATION_FAILED") {
            process.stderr.write(`atw-apply-migrations: ${err.message}\n`);
            return 6;
        }
        process.stderr.write(`atw-apply-migrations: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=apply-migrations.js.map