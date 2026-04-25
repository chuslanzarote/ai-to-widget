import { promises as fs } from "node:fs";
import { parseArgs } from "node:util";
import { z } from "zod";
import Debug from "debug";
import { EnrichedFactSchema } from "./lib/types.js";
const log = Debug("atw:upsert-document");
/**
 * Row shape accepted by `atw-upsert-document`. Matches `atw_documents`
 * plus metadata required for the source_hash skip rule.
 */
export const UpsertDocumentRowSchema = z.object({
    entity_type: z.string().min(1),
    entity_id: z.string().min(1),
    document: z.string().min(1),
    facts: z.array(EnrichedFactSchema),
    categories: z.record(z.array(z.string())),
    embedding: z.array(z.number()),
    source_hash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    opus_tokens: z.object({
        input_tokens: z.number().int().nonnegative(),
        output_tokens: z.number().int().nonnegative(),
    }),
});
const EMBEDDING_DIM = 384;
export async function upsertDocument(opts) {
    if (opts.row.embedding.length !== EMBEDDING_DIM) {
        const e = new Error(`Embedding dimension mismatch: got ${opts.row.embedding.length}, expected ${EMBEDDING_DIM}`);
        e.code = "EMBED_DIM_MISMATCH";
        throw e;
    }
    const { Client } = await import("pg");
    const client = new Client(opts.connectionConfig);
    try {
        await client.connect();
    }
    catch (err) {
        const e = new Error(`Postgres not reachable: ${err.message}`);
        e.code = "PG_UNREACHABLE";
        throw e;
    }
    try {
        const existing = await client.query("SELECT source_hash FROM atw_documents WHERE entity_type = $1 AND entity_id = $2", [opts.row.entity_type, opts.row.entity_id]);
        if (existing.rowCount && existing.rows[0].source_hash === opts.row.source_hash && !opts.force) {
            log("skip %s/%s (source_hash match)", opts.row.entity_type, opts.row.entity_id);
            return {
                action: "skipped",
                entity_type: opts.row.entity_type,
                entity_id: opts.row.entity_id,
            };
        }
        const emb = toPgVectorLiteral(opts.row.embedding);
        const sql = `
      INSERT INTO atw_documents
        (entity_type, entity_id, document, facts, categories, embedding, source_hash, opus_tokens)
      VALUES
        ($1, $2, $3, $4::jsonb, $5::jsonb, $6::vector, $7, $8::jsonb)
      ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        document = EXCLUDED.document,
        facts = EXCLUDED.facts,
        categories = EXCLUDED.categories,
        embedding = EXCLUDED.embedding,
        source_hash = EXCLUDED.source_hash,
        opus_tokens = EXCLUDED.opus_tokens,
        updated_at = now()
    `;
        const params = [
            opts.row.entity_type,
            opts.row.entity_id,
            opts.row.document,
            JSON.stringify(opts.row.facts),
            JSON.stringify(opts.row.categories),
            emb,
            opts.row.source_hash,
            JSON.stringify(opts.row.opus_tokens),
        ];
        await client.query(sql, params);
        return {
            action: existing.rowCount ? "updated" : "inserted",
            entity_type: opts.row.entity_type,
            entity_id: opts.row.entity_id,
        };
    }
    finally {
        await client.end().catch(() => void 0);
    }
}
/**
 * pgvector expects `[v1,v2,...]` as text. We avoid `::vector` cast on the
 * client side by formatting a single string and relying on the explicit
 * cast in the SQL above.
 */
export function toPgVectorLiteral(vec) {
    return "[" + vec.map((n) => formatFloat(n)).join(",") + "]";
}
function formatFloat(n) {
    if (!Number.isFinite(n)) {
        throw new Error(`Embedding value is not finite: ${n}`);
    }
    return n.toString();
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            row: { type: "string" },
            force: { type: "boolean", default: false },
            json: { type: "boolean", default: false },
            host: { type: "string" },
            port: { type: "string" },
            user: { type: "string" },
            password: { type: "string" },
            database: { type: "string" },
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
    return {
        row: values.row ? String(values.row) : undefined,
        force: Boolean(values.force),
        json: Boolean(values.json),
        host: String(values.host ?? "127.0.0.1"),
        port,
        user: String(values.user ?? "atw"),
        password: String(values.password ?? "atw"),
        database: String(values.database ?? "atw"),
    };
}
async function readRow(p) {
    if (p) {
        const raw = await fs.readFile(p, "utf8");
        return JSON.parse(raw);
    }
    const chunks = [];
    for await (const c of process.stdin)
        chunks.push(c);
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function runUpsertDocument(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-upsert-document: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-upsert-document --row <path-or-stdin> [--force] [--json]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-upsert-document 0.1.0\n");
        return 0;
    }
    try {
        const raw = await readRow(opts.row);
        const row = UpsertDocumentRowSchema.parse(raw);
        const result = await upsertDocument({
            row,
            force: opts.force,
            connectionConfig: {
                host: opts.host,
                port: opts.port,
                user: opts.user,
                password: opts.password,
                database: opts.database,
            },
        });
        if (opts.json) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else {
            process.stdout.write(`${result.action} ${result.entity_type}/${result.entity_id}\n`);
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        if (code === "EMBED_DIM_MISMATCH") {
            process.stderr.write(`atw-upsert-document: ${err.message}\n`);
            return 15;
        }
        if (code === "PG_UNREACHABLE") {
            process.stderr.write(`atw-upsert-document: ${err.message}\n`);
            return 16;
        }
        process.stderr.write(`atw-upsert-document: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=upsert-document.js.map