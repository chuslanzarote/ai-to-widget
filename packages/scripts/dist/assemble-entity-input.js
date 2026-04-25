import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";
import { AssembledEntityInputSchema, } from "./lib/types.js";
const log = Debug("atw:assemble-entity-input");
const ASSEMBLER_VERSION = "1";
/**
 * Assemble one entity's structured input for Opus. Throws:
 *  - `ENTITY_NOT_FOUND` when the primary row is missing (exit 9)
 *  - `SCHEMA_CORRUPT` when schema-map references a missing table (exit 10)
 */
export async function assembleEntityInput(opts) {
    const ent = opts.schemaMap.entities.find((e) => e.name === opts.entityType);
    if (!ent) {
        const e = new Error(`entity_type "${opts.entityType}" not found in schema-map`);
        e.code = "SCHEMA_CORRUPT";
        throw e;
    }
    const { Client } = await import("pg");
    const client = new Client(opts.connectionConfig);
    await client.connect();
    try {
        const primaryRaw = ent.sourceTables[0];
        if (!primaryRaw) {
            const e = new Error(`entity "${opts.entityType}" has no source tables`);
            e.code = "SCHEMA_CORRUPT";
            throw e;
        }
        const primaryTable = primaryRaw.toLowerCase().replace(/^[a-z_][a-z0-9_]*\./, "");
        const indexedCols = ent.columns
            .filter((c) => c.decision === "index" || c.decision === "reference")
            .map((c) => c.name);
        if (indexedCols.length === 0) {
            const e = new Error(`entity "${opts.entityType}" has no indexed/reference columns — nothing to send to Opus`);
            e.code = "SCHEMA_CORRUPT";
            throw e;
        }
        const cols = indexedCols.map((c) => `"${c}"`).join(", ");
        let res;
        try {
            res = await client.query(`SELECT ${cols} FROM client_ref."${primaryTable}" WHERE id = $1 LIMIT 1`, [opts.entityId]);
        }
        catch (err) {
            const msg = err.message ?? "";
            if (/relation .* does not exist/i.test(msg)) {
                const e = new Error(`Schema-map references missing table "${primaryTable}" in client_ref`);
                e.code = "SCHEMA_CORRUPT";
                throw e;
            }
            throw err;
        }
        if (res.rowCount === 0) {
            const e = new Error(`entity_id "${opts.entityId}" not found in client_ref."${primaryTable}"`);
            e.code = "ENTITY_NOT_FOUND";
            throw e;
        }
        const primary = res.rows[0];
        // Related tables: pull at most 20 rows of each joined reference.
        const related = [];
        for (const refRaw of ent.joinedReferences) {
            const ref = refRaw.toLowerCase().replace(/^[a-z_][a-z0-9_]*\./, "");
            try {
                const refRes = await client.query(`SELECT * FROM client_ref."${ref}" WHERE ${opts.entityType}_id = $1 LIMIT 20`, [opts.entityId]);
                related.push({
                    relation: ref,
                    rows: refRes.rows,
                });
            }
            catch (err) {
                log("related query failed for %s: %s", ref, err.message);
            }
        }
        const out = {
            entity_type: opts.entityType,
            entity_id: opts.entityId,
            project_brief_summary: opts.briefSummary,
            primary_record: primary,
            related,
            metadata: {
                assembled_at: (opts.now ?? new Date()).toISOString(),
                assembler_version: ASSEMBLER_VERSION,
            },
        };
        return AssembledEntityInputSchema.parse(out);
    }
    finally {
        await client.end().catch(() => void 0);
    }
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            "entity-type": { type: "string" },
            "entity-id": { type: "string" },
            "schema-map": { type: "string" },
            brief: { type: "string" },
            host: { type: "string" },
            port: { type: "string" },
            user: { type: "string" },
            password: { type: "string" },
            database: { type: "string" },
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
    if (!values["entity-type"])
        throw new Error("--entity-type <t> is required");
    if (!values["entity-id"])
        throw new Error("--entity-id <id> is required");
    if (!values["schema-map"])
        throw new Error("--schema-map <path> is required");
    if (!values.brief)
        throw new Error("--brief <path> is required");
    const port = values.port ? Number.parseInt(String(values.port), 10) : 5433;
    return {
        entityType: String(values["entity-type"]),
        entityId: String(values["entity-id"]),
        schemaMap: String(values["schema-map"]),
        brief: String(values.brief),
        host: String(values.host ?? "127.0.0.1"),
        port,
        user: String(values.user ?? "atw"),
        password: String(values.password ?? "atw"),
        database: String(values.database ?? "atw"),
        json: Boolean(values.json),
    };
}
export async function runAssembleEntityInput(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-assemble-entity-input: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-assemble-entity-input --entity-type <t> --entity-id <id> --schema-map <path> --brief <path> [--json]\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-assemble-entity-input 0.1.0\n");
        return 0;
    }
    try {
        const { loadArtifactFromFile } = await import("./load-artifact.js");
        const schemaArt = await loadArtifactFromFile("schema-map", path.resolve(opts.schemaMap));
        const briefArt = await loadArtifactFromFile("brief", path.resolve(opts.brief));
        if (schemaArt.kind !== "schema-map" || briefArt.kind !== "brief") {
            throw new Error("Loaded wrong artifact kind");
        }
        const briefSummary = `${briefArt.content.businessScope} Customers: ${briefArt.content.customers}`;
        const assembled = await assembleEntityInput({
            entityType: opts.entityType,
            entityId: opts.entityId,
            schemaMap: schemaArt.content,
            briefSummary,
            connectionConfig: {
                host: opts.host,
                port: opts.port,
                user: opts.user,
                password: opts.password,
                database: opts.database,
            },
        });
        if (opts.json) {
            process.stdout.write(JSON.stringify(assembled) + "\n");
        }
        else {
            process.stdout.write(JSON.stringify(assembled, null, 2) + "\n");
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        if (code === "ENTITY_NOT_FOUND") {
            process.stderr.write(`atw-assemble-entity-input: ${err.message}\n`);
            return 9;
        }
        if (code === "SCHEMA_CORRUPT") {
            process.stderr.write(`atw-assemble-entity-input: ${err.message}\n`);
            return 10;
        }
        process.stderr.write(`atw-assemble-entity-input: ${err.message}\n`);
        return 1;
    }
}
//# sourceMappingURL=assemble-entity-input.js.map