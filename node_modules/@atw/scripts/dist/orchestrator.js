import { existsSync, readFileSync, promises as fs } from "node:fs";
import { join, relative, resolve } from "node:path";
import { randomBytes, createHash } from "node:crypto";
import Debug from "debug";
import { writeManifestAtomic, defaultManifestPath } from "./lib/manifest-io.js";
import { ProgressReporter, formatLine } from "./lib/progress.js";
import { computeSourceHash, stripMetadataForHash } from "./lib/source-hash.js";
import { computeCostUsd } from "./lib/pricing.js";
import { computeCostVariancePct } from "./lib/cost-variance.js";
import { computeInputHashes, diffInputHashes, readInputHashes, writeInputHashes, } from "./lib/input-hashes.js";
import { loadArtifactFromFile } from "./load-artifact.js";
import { startPostgres } from "./start-postgres.js";
import { applyMigrations, defaultMigrationsDir } from "./apply-migrations.js";
import { importDump } from "./import-dump.js";
import { assembleEntityInput } from "./assemble-entity-input.js";
import { embedText } from "./embed-text.js";
import { enrichEntity, defaultOpusClient, PROMPT_TEMPLATE_VERSION, ENRICH_V1_SYSTEM, } from "./enrich-entity.js";
import { upsertDocument } from "./upsert-document.js";
import { renderBackend, defaultTemplatesDir, loadRuntimeToolsFromManifest, } from "./render-backend.js";
import { compileWidget } from "./compile-widget.js";
import { buildBackendImage } from "./build-backend-image.js";
import { composeActivate } from "./compose-activate.js";
import { scanPiiLeaks } from "./scan-pii-leaks.js";
import { ConcurrencyController } from "./lib/concurrency-control.js";
import { startPhase, readProvenance, findCachedSuccess, summarize as summarizeProvenance, } from "./lib/build-provenance.js";
import { loadProjectConfig, ProjectConfigError } from "./lib/runtime-config.js";
const log = Debug("atw:orchestrator");
const DEFAULT_OPUS_MODEL = "claude-opus-4-7";
const DEFAULT_EMBEDDING_MODEL = "Xenova/bge-small-en-v1.5";
const DEFAULT_POSTGRES_PORT = 5433;
const DEFAULT_CONCURRENCY = 10;
const REQUIRED_ARTIFACTS = [
    ".atw/config/project.md",
    ".atw/config/brief.md",
    ".atw/artifacts/schema-map.md",
    ".atw/artifacts/action-manifest.md",
    ".atw/artifacts/build-plan.md",
];
const PRIOR_COMMAND_FOR_ARTIFACT = {
    ".atw/config/project.md": "/atw.init",
    ".atw/config/brief.md": "/atw.brief",
    ".atw/artifacts/schema-map.md": "/atw.schema",
    ".atw/artifacts/action-manifest.md": "/atw.api",
    ".atw/artifacts/build-plan.md": "/atw.plan",
};
/**
 * Orchestrator entry point for `/atw.build`.
 *
 * Sequence (US1 happy path, contract: slash-command.md §3):
 *   BOOT → MIGRATE → IMPORT → ENRICH → RENDER → BUNDLE → IMAGE → SCAN → DONE
 *
 * US2 adds the full validator + sharpening retry in enrich-entity.
 * US3 adds source_hash skip; US4 adds cost accounting;
 * US5 adds manifest-diff incremental short-circuit; US6 failure reasons;
 * US7 adds SIGINT handling; US8 determinism; US9 --concurrency auto-reduce.
 */
export async function runBuild(flags) {
    log("runBuild flags=%o", flags);
    if (flags.help) {
        printHelp();
        return { exitCode: 0, manifest: null };
    }
    if (flags.version) {
        printVersion();
        return { exitCode: 0, manifest: null };
    }
    // Flag guard (FR-072)
    if (flags.entitiesOnly && flags.noEnrich) {
        process.stderr.write("Error: --entities-only and --no-enrich cannot be combined. Enrichment is how entities are populated.\n");
        return { exitCode: 3, manifest: null };
    }
    // Artifact prerequisites (FR-053)
    const missing = missingArtifacts(flags.projectRoot);
    if (missing.length > 0) {
        const first = missing[0];
        const prior = PRIOR_COMMAND_FOR_ARTIFACT[first] ?? "/atw.plan";
        process.stderr.write(`Missing ${first}. Run ${prior} first.\n`);
        return { exitCode: 3, manifest: null };
    }
    // T070 / US4 — parse build-plan.md upfront so the plan summary can
    // surface the Builder's own cost estimate (the value /atw.plan wrote)
    // before any Opus calls are made. Parsing failures degrade silently:
    // the rest of the build still runs, the estimate is treated as absent.
    const planSummary = await readPlanSummary(flags.projectRoot);
    // Plan summary (§2)
    process.stdout.write("AI to Widget — build plan\n");
    process.stdout.write(`\n  Project root      : ${flags.projectRoot}\n`);
    process.stdout.write(`  Concurrency       : ${flags.concurrency ?? DEFAULT_CONCURRENCY}\n`);
    process.stdout.write(`  Postgres port     : ${flags.postgresPort ?? DEFAULT_POSTGRES_PORT}\n`);
    if (planSummary.estimatedCostUsd !== null) {
        process.stdout.write(`  Estimated cost    : $${planSummary.estimatedCostUsd.toFixed(2)} (from build-plan.md)\n`);
    }
    if (planSummary.estimatedDurationRange) {
        process.stdout.write(`  Estimated duration: ${planSummary.estimatedDurationRange}\n`);
    }
    if (flags.dryRun) {
        process.stdout.write("\n  (--dry-run set; no Opus calls or Docker writes will happen.)\n");
        return { exitCode: 0, manifest: null };
    }
    const startedAt = new Date();
    const buildId = generateBuildId(startedAt.getTime());
    // FR-028 build-provenance entries use a ULID build_id distinct from the
    // legacy `atw-build-…-<hex>` ID (the legacy ID stays in build-manifest.json
    // for backward compatibility). The two co-exist; the ULID is the join key
    // for the FR-031 cache and the FR-028 status summary.
    const provenanceBuildId = generateUlid(startedAt.getTime());
    const provenanceProjectRoot = flags.projectRoot;
    const projectConfigForProvenance = (() => {
        try {
            return loadProjectConfig({ projectRoot: flags.projectRoot });
        }
        catch (err) {
            if (!(err instanceof ProjectConfigError))
                throw err;
            return null;
        }
    })();
    const modelSnapshot = projectConfigForProvenance?.model_snapshot ?? "claude-opus-4-7";
    const progress = new ProgressReporter();
    const concurrency = flags.concurrency ?? DEFAULT_CONCURRENCY;
    const postgresPort = flags.postgresPort ?? DEFAULT_POSTGRES_PORT;
    // T065 / US3 — load prior input-hashes before touching Docker so any
    // "nothing to do" short-circuit (US5) can fire before Postgres boot.
    const priorInputHashes = readInputHashes(flags.projectRoot);
    log("priorInputHashes: %o", priorInputHashes ? "present" : "absent");
    // T074 / T075 / T076 / US5 — incremental rebuild decision.
    // Compute current input-hashes BEFORE touching Docker. If every tracked
    // file matches the prior successful run and the prompt template didn't
    // move, we short-circuit to "nothing-to-do" without ever booting
    // Postgres — SC-013 demands this completes in under 30 s. If only
    // `action-manifest.md` changed, we skip enrichment later (FR-081). If
    // `brief.md` changed, we surface a warning (FR-082).
    const currentInputHashesPreboot = (() => {
        try {
            // No SQL dump path yet (we haven't scanned .atw/inputs), so pass
            // null; the SQL dump will be folded into the written hashes later.
            return computeInputHashes(flags.projectRoot, null, PROMPT_TEMPLATE_VERSION);
        }
        catch (err) {
            log("computeInputHashes (preboot) failed: %s", err.message);
            return null;
        }
    })();
    const incrementalDiff = currentInputHashesPreboot !== null
        ? diffInputHashes(priorInputHashes, currentInputHashesPreboot)
        : null;
    // US5 nothing-to-do short-circuit (FR-080): all hashes match AND prompt
    // template hasn't moved AND --force isn't set AND this isn't a first
    // ever run (priorInputHashes !== null). Exit 0 without Docker/Opus.
    if (!flags.force &&
        priorInputHashes !== null &&
        incrementalDiff !== null &&
        incrementalDiff.sameTotal) {
        const completedAt = new Date();
        const buildIdShort = generateBuildId(Date.now());
        const manifest = {
            schema_version: "1",
            build_id: buildIdShort,
            started_at: completedAt.toISOString(),
            completed_at: completedAt.toISOString(),
            duration_seconds: 0,
            result: "nothing-to-do",
            totals: { total_entities: 0, enriched: 0, skipped_unchanged: 0, failed: 0 },
            failures: [],
            opus: {
                calls: 0,
                input_tokens: 0,
                output_tokens: 0,
                cost_usd: 0,
            },
            concurrency: {
                configured: flags.concurrency ?? DEFAULT_CONCURRENCY,
                effective_max: flags.concurrency ?? DEFAULT_CONCURRENCY,
                reductions: [],
            },
            input_hashes: hashAllInputs(flags.projectRoot),
            outputs: {
                backend_files: [],
                widget_bundle: null,
                backend_image: null,
            },
            environment: captureEnvironment(),
            compliance_scan: { ran: false, clean: true, values_checked: 0, matches: [] },
        };
        try {
            writeManifestAtomic(defaultManifestPath(flags.projectRoot), manifest);
            await writeInputHashes(flags.projectRoot, currentInputHashesPreboot);
        }
        catch (err) {
            log("nothing-to-do manifest/hashes write failed: %s", err.message);
        }
        process.stdout.write("\n[DONE] Nothing to do — all inputs unchanged since last build.\n");
        return { exitCode: 0, manifest };
    }
    // US5 partial-rebuild mode (FR-081): if the only thing that changed is
    // `action-manifest.md`, enrichment is still valid — we only need to
    // re-render backend/widget and rebuild the image.
    const skipEnrichmentForIncremental = (() => {
        if (flags.force)
            return false;
        if (!priorInputHashes || !incrementalDiff)
            return false;
        if (incrementalDiff.promptVersionChanged)
            return false;
        return (incrementalDiff.changedKeys.length === 1 &&
            incrementalDiff.changedKeys[0] === ".atw/artifacts/action-manifest.md");
    })();
    if (skipEnrichmentForIncremental) {
        process.stdout.write("\n[INCREMENTAL] Only action-manifest.md changed — skipping enrichment.\n");
    }
    // US5 brief-change warning (FR-082): re-enrichment is encouraged but
    // not forced. The Builder keeps the ability to decide.
    if (!flags.force &&
        priorInputHashes &&
        incrementalDiff &&
        incrementalDiff.changedKeys.includes(".atw/config/brief.md")) {
        process.stderr.write("Warning: brief.md changed since last build. Consider /atw.build --force to re-enrich all entities.\n");
    }
    // T079 / T086 / US6 — probe ANTHROPIC_API_KEY upfront, before Docker
    // boots. FR-085 requires the Builder see an auth diagnostic before any
    // container spends time starting up, and before the first Opus call is
    // billed. Skipped when enrichment is off or when the tests inject an
    // opus client stub.
    if (!flags.noEnrich && !skipEnrichmentForIncremental && !flags.opusClient) {
        const hasKey = typeof process.env.ANTHROPIC_API_KEY === "string" && process.env.ANTHROPIC_API_KEY.length > 0;
        if (!hasKey) {
            process.stderr.write("Anthropic API authentication failed. Set ANTHROPIC_API_KEY in your shell environment and re-run /atw.build.\n");
            return { exitCode: 3, manifest: null };
        }
    }
    // T066 / US3 — SIGINT handler (contract: slash-command.md §6). On
    // Ctrl+C, stop scheduling new Opus calls; in-flight calls complete and
    // are validated+upserted normally. Render/bundle/image/scan phases are
    // then skipped and the manifest is written with result="aborted".
    const abortState = { aborted: false, inFlight: 0 };
    const sigintHandler = () => {
        if (abortState.aborted)
            return;
        abortState.aborted = true;
        process.stderr.write(`\nAborting — letting ${abortState.inFlight} in-flight Opus calls complete so their cost is not wasted ...\n`);
    };
    process.on("SIGINT", sigintHandler);
    const totals = { total_entities: 0, enriched: 0, skipped_unchanged: 0, failed: 0 };
    const failures = [];
    const opusTotals = {
        calls: 0,
        input_tokens: 0,
        output_tokens: 0,
    };
    const backendFiles = [];
    let widgetBundle = null;
    let backendImage = null;
    let complianceScan = {
        ran: false,
        clean: true,
        values_checked: 0,
        matches: [],
    };
    // T099 / T100 — hoisted so both the success-path manifest and the
    // catch-path manifest below can reflect any auto-reduce that fired
    // before the build ended (successfully or otherwise).
    let concurrencyControllerRef = null;
    try {
        // 1. BOOT -----------------------------------------------------------
        progress.banner(banner("BOOT", `Starting atw_postgres (pgvector/pgvector:pg16) on :${postgresPort} ...`));
        const pg = await startPostgres({ port: postgresPort, waitSeconds: 60 });
        const connectionConfig = {
            host: "127.0.0.1",
            port: pg.port,
            user: "atw",
            password: "atw",
            database: "atw",
        };
        // 2. MIGRATE --------------------------------------------------------
        progress.banner(banner("MIGRATE", "Applying migrations ..."));
        const migrated = await applyMigrations({
            migrationsDir: defaultMigrationsDir(),
            dryRun: false,
            connectionConfig,
        });
        progress.banner(banner("MIGRATE", `${migrated.applied.length} applied, ${migrated.skipped.length} already present`));
        // 3. IMPORT ---------------------------------------------------------
        const schemaMap = await loadSchemaMap(flags.projectRoot);
        const dumpPath = await findSqlDump(flags.projectRoot);
        {
            const rec = startPhase("IMPORT", provenanceBuildId);
            try {
                if (dumpPath && !flags.noEnrich) {
                    progress.banner(banner("IMPORT", `Filtering dump → client_ref ...`));
                    await importDump({
                        dumpPath,
                        schemaMap: schemaArtifactToImport(schemaMap),
                        connectionConfig,
                        replace: true,
                    });
                    await rec.finish(provenanceProjectRoot, { status: "success" });
                }
                else if (!dumpPath) {
                    progress.banner(banner("IMPORT", "No .atw/inputs/*.sql dump found — skipping import"));
                    await rec.finish(provenanceProjectRoot, {
                        status: "skipped",
                        skipped_reason: "no .atw/inputs/*.sql dump present",
                        next_hint: "Drop a pg_dump file at .atw/inputs/<name>.sql and re-run /atw.build",
                    });
                }
                else {
                    await rec.finish(provenanceProjectRoot, {
                        status: "skipped",
                        skipped_reason: "--no-enrich set",
                        next_hint: "Drop --no-enrich to import + enrich on the next run",
                    });
                }
            }
            catch (err) {
                await rec.finish(provenanceProjectRoot, {
                    status: "failed",
                    failed_reason: err.message,
                    next_hint: "Inspect the SQL dump for parse errors, then re-run /atw.build",
                });
                throw err;
            }
        }
        // 4. ENRICH ---------------------------------------------------------
        let entityIds = [];
        const enrichRec = startPhase("ENRICH", provenanceBuildId);
        if (!flags.noEnrich && !skipEnrichmentForIncremental) {
            entityIds = await listIndexableEntityIds({ schemaMap, connectionConfig });
            totals.total_entities = entityIds.length;
            progress.banner(banner("ENRICH", `${entityIds.length} entities to enrich @ concurrency ${concurrency}`));
            const opusClient = flags.opusClient ??
                (await defaultOpusClient(DEFAULT_OPUS_MODEL, process.env.ANTHROPIC_API_KEY));
            const { default: pLimit } = await import("p-limit");
            const limit = pLimit(concurrency);
            // T099 / US9 — dynamic concurrency controller. Lowers the
            // effective cap from `concurrency` → 3 after 3 consecutive 429s,
            // and raises the halt flag after 3 more at 3. p-limit remains the
            // outer admission gate; the controller's DynamicGate is an inner
            // gate that can tighten without preempting in-flight calls.
            const concurrencyController = new ConcurrencyController({ initial: concurrency });
            concurrencyControllerRef = concurrencyController;
            const enrichStart = Date.now();
            let processed = 0;
            await Promise.all(entityIds.map((ent) => limit(async () => {
                // T066 / US3 — once SIGINT has fired, do not schedule any new
                // Opus work. In-flight calls (already inside this closure
                // past this guard) continue to completion as required by §6.
                if (abortState.aborted)
                    return;
                abortState.inFlight += 1;
                try {
                    const input = await assembleEntityInput({
                        entityType: ent.type,
                        entityId: ent.id,
                        schemaMap,
                        briefSummary: "",
                        connectionConfig,
                    });
                    // T063 / US3 — source_hash skip: if an atw_documents row
                    // already exists with a matching hash (and --force is off),
                    // skip the Opus call entirely. Resumed runs pay nothing for
                    // work the prior run already completed.
                    const expectedHash = computeSourceHash({
                        assembledWithoutMetadata: stripMetadataForHash(input),
                        promptTemplateVersion: PROMPT_TEMPLATE_VERSION,
                        modelId: DEFAULT_OPUS_MODEL,
                    });
                    if (!flags.force) {
                        const alreadyIndexed = await existingSourceHashMatches({
                            connectionConfig,
                            entity_type: ent.type,
                            entity_id: ent.id,
                            expected: expectedHash,
                        });
                        if (alreadyIndexed) {
                            totals.skipped_unchanged += 1;
                            return;
                        }
                    }
                    // T099 / US9 — hold a gate slot while Opus is in flight.
                    // The gate can be tightened mid-run; this caller will
                    // block if the ceiling drops below current in-flight.
                    await concurrencyController.gate.acquire();
                    let callResult;
                    try {
                        callResult = await enrichEntity({
                            input,
                            opusClient,
                            model: DEFAULT_OPUS_MODEL,
                            systemPrompt: ENRICH_V1_SYSTEM,
                            apiKey: process.env.ANTHROPIC_API_KEY,
                            onHttpStatus: (s) => concurrencyController.onHttpStatus(s),
                        });
                    }
                    finally {
                        concurrencyController.gate.release();
                    }
                    if (concurrencyController.halt) {
                        const e = new Error("Opus rate limits exhausted even at reduced concurrency");
                        e.code = "OPUS_RATE_LIMIT";
                        throw e;
                    }
                    opusTotals.calls += 1;
                    opusTotals.input_tokens += callResult.tokens.input_tokens;
                    opusTotals.output_tokens += callResult.tokens.output_tokens;
                    if (callResult.validationFailedTwice) {
                        // Principle V: two rejections → flag and skip, build continues.
                        const rules = (callResult.rejectedRules ?? []).join(" → ");
                        failures.push({
                            entity_type: ent.type,
                            entity_id: ent.id,
                            reason: "validation_failed_twice",
                            details: rules || "validator rejected twice",
                        });
                        totals.failed += 1;
                        return;
                    }
                    if ("insufficient_data" in callResult.response) {
                        failures.push({
                            entity_type: ent.type,
                            entity_id: ent.id,
                            reason: "insufficient_data",
                            details: callResult.response.reason,
                        });
                        totals.failed += 1;
                        return;
                    }
                    const embedding = await embedText(callResult.response.document, DEFAULT_EMBEDDING_MODEL);
                    // T088 / US7 — per-entity atomicity. The row is written by a
                    // single INSERT ... ON CONFLICT statement (see
                    // `upsert-document.ts`), which Postgres commits atomically.
                    // If embedText or Opus threw before this point, no row was
                    // written for the entity and a resumed build will re-enrich
                    // it. If the INSERT itself throws, Postgres rolls back the
                    // statement. A SIGINT arriving mid-statement cannot leave a
                    // torn row — only fully committed rows survive the abort.
                    const action = await upsertDocument({
                        row: {
                            entity_type: ent.type,
                            entity_id: ent.id,
                            document: callResult.response.document,
                            facts: callResult.response.facts,
                            categories: callResult.response.categories,
                            embedding,
                            source_hash: expectedHash,
                            opus_tokens: callResult.tokens,
                        },
                        connectionConfig,
                        force: Boolean(flags.force),
                    });
                    if (action.action === "skipped") {
                        totals.skipped_unchanged += 1;
                    }
                    else {
                        totals.enriched += 1;
                    }
                }
                catch (err) {
                    const reason = classifyFailure(err);
                    failures.push({
                        entity_type: ent.type,
                        entity_id: ent.id,
                        reason,
                        details: err.message,
                    });
                    totals.failed += 1;
                }
                finally {
                    abortState.inFlight = Math.max(0, abortState.inFlight - 1);
                    processed += 1;
                    progress.report({
                        phase: "ENRICH",
                        processed,
                        total: entityIds.length,
                        ok: totals.enriched,
                        skipped: totals.skipped_unchanged,
                        failed: totals.failed,
                        cost_usd: computeCostUsd(opusTotals),
                        elapsed_seconds: (Date.now() - enrichStart) / 1000,
                        eta_seconds: etaFromRate(processed, entityIds.length, (Date.now() - enrichStart) / 1000),
                    });
                }
            })));
            // FR-028: ENRICH provenance entry. Recorded only after the gather
            // completes — failures here drop into the outer catch which records a
            // `failed` entry instead.
            const enrichStatus = totals.failed > 0
                ? "warning"
                : totals.total_entities === 0
                    ? "skipped"
                    : "success";
            await enrichRec.finish(provenanceProjectRoot, {
                status: enrichStatus,
                model_snapshot: modelSnapshot,
                warnings: enrichStatus === "warning"
                    ? failures.slice(0, 5).map((f) => `${f.entity_type}#${f.entity_id}: ${f.reason}`)
                    : undefined,
                skipped_reason: enrichStatus === "skipped" ? "no indexable entities found" : undefined,
                next_hint: enrichStatus === "warning"
                    ? "Inspect the failures listed in build-manifest.json, then re-run /atw.build"
                    : enrichStatus === "skipped"
                        ? "Check schema-map.md classification — at least one entity must be `indexable`"
                        : null,
            });
        }
        else {
            await enrichRec.finish(provenanceProjectRoot, {
                status: skipEnrichmentForIncremental ? "skipped" : "skipped",
                model_snapshot: modelSnapshot,
                skipped_reason: skipEnrichmentForIncremental
                    ? "only action-manifest.md changed — incremental rebuild"
                    : "--no-enrich set",
                next_hint: skipEnrichmentForIncremental
                    ? null
                    : "Drop --no-enrich to re-enrich on the next run",
            });
        }
        // 5. RENDER ---------------------------------------------------------
        // T066 / US3 — on abort, skip render/bundle/image/compose/scan per §6.
        renderPhase: {
            const rec = startPhase("RENDER", provenanceBuildId);
            if (!flags.entitiesOnly && !abortState.aborted) {
                try {
                    const manifestPath = join(flags.projectRoot, ".atw/artifacts/action-manifest.md");
                    // FR-008b / T043: input-hash cache. If a prior successful RENDER
                    // entry matches `(input_hashes, model_snapshot)` we record
                    // `success_cached` and skip.
                    const renderInputHashes = await computeRenderInputHashes({
                        projectRoot: flags.projectRoot,
                        manifestPath,
                        templatesDir: defaultTemplatesDir(),
                    });
                    const cached = findCachedSuccess(provenanceProjectRoot, "RENDER", renderInputHashes, modelSnapshot);
                    if (cached && !flags.force) {
                        await rec.finish(provenanceProjectRoot, {
                            status: "success_cached",
                            model_snapshot: modelSnapshot,
                            input_hashes: renderInputHashes,
                        });
                        break renderPhase;
                    }
                    progress.banner(banner("RENDER", "Rendering backend/src/*.ts ..."));
                    let runtimeTools = [];
                    try {
                        runtimeTools = loadRuntimeToolsFromManifest(manifestPath);
                    }
                    catch {
                        // No manifest yet (e.g., entities-only path or first build before
                        // /atw.api). Render with an empty tool list — RUNTIME_TOOLS = [].
                        runtimeTools = [];
                    }
                    const rendered = await renderBackend({
                        templatesDir: defaultTemplatesDir(),
                        outputDir: join(flags.projectRoot, "backend", "src"),
                        context: {
                            projectName: readProjectName(flags.projectRoot),
                            embeddingModel: DEFAULT_EMBEDDING_MODEL,
                            anthropicModel: DEFAULT_OPUS_MODEL,
                            generatedAt: new Date().toISOString(),
                            tools: runtimeTools,
                            defaultLocale: readDefaultLocale(flags.projectRoot),
                            briefSummary: readBriefSummary(flags.projectRoot),
                        },
                        backup: Boolean(flags.backup),
                    });
                    for (const r of rendered) {
                        backendFiles.push({
                            path: r.path,
                            sha256: r.sha256,
                            bytes: r.bytes,
                            action: r.action,
                        });
                    }
                    await rec.finish(provenanceProjectRoot, {
                        status: "success",
                        model_snapshot: modelSnapshot,
                        input_hashes: renderInputHashes,
                    });
                }
                catch (err) {
                    await rec.finish(provenanceProjectRoot, {
                        status: "failed",
                        failed_reason: err.message,
                        next_hint: "Inspect the offending template, then re-run /atw.build",
                    });
                    throw err;
                }
            }
            else {
                await rec.finish(provenanceProjectRoot, {
                    status: flags.entitiesOnly ? "skipped" : "not_run",
                    skipped_reason: flags.entitiesOnly ? "--entities-only set" : undefined,
                    failed_reason: undefined,
                    next_hint: flags.entitiesOnly
                        ? "Drop --entities-only to render the backend on the next run"
                        : "Build was aborted before RENDER",
                });
            }
        }
        // 6. BUNDLE ---------------------------------------------------------
        if (!flags.entitiesOnly && !abortState.aborted) {
            progress.banner(banner("BUNDLE", "Bundling dist/widget.{js,css} ..."));
            const widgetOut = await compileWidget({
                outDir: join(flags.projectRoot, "dist"),
                minify: true,
            });
            widgetBundle = {
                js: widgetOut.js,
                css: widgetOut.css,
                source: widgetOut.source,
            };
        }
        // 7. IMAGE ----------------------------------------------------------
        if (!flags.entitiesOnly && !flags.skipImage && !abortState.aborted) {
            progress.banner(banner("IMAGE", "Building atw_backend:latest (multi-stage) ..."));
            try {
                const img = await buildBackendImage({
                    contextDir: join(flags.projectRoot, "backend"),
                    dockerfile: "Dockerfile",
                    tag: "atw_backend:latest",
                });
                backendImage = {
                    ref: img.ref,
                    image_id: img.image_id,
                    size_bytes: img.size_bytes,
                };
            }
            catch (err) {
                // Feature 002 US1 MVP: if no backend Dockerfile present (e.g. in
                // tests with stubbed scaffolding), record the failure but do not
                // abort the whole build. US9 revisits the failure taxonomy.
                log("image build skipped: %s", err.message);
            }
        }
        // 8. COMPOSE ACTIVATE ----------------------------------------------
        {
            const rec = startPhase("COMPOSE", provenanceBuildId);
            if (!flags.entitiesOnly && !abortState.aborted) {
                const composePath = join(flags.projectRoot, "docker-compose.yml");
                if (existsSync(composePath)) {
                    try {
                        const result = await composeActivate(composePath, {
                            // FR-029 / R7 / Q3: integrator must confirm `[y/N]` before ATW
                            // mutates the host compose file. The orchestrator's flag
                            // `flags.yes` (`--yes`/`-y`) auto-confirms; otherwise we
                            // decline and surface the diff.
                            confirmAppend: async () => Boolean(flags.yes),
                        });
                        if (result.action === "no-markers") {
                            process.stdout.write(`[COMPOSE] markers absent — skipped. Re-run /atw.build with -y to append, or paste:\n${result.proposed_diff ?? ""}\n`);
                            await rec.finish(provenanceProjectRoot, {
                                status: "skipped",
                                skipped_reason: result.skipped_reason ?? "host compose lacks atw markers",
                                next_hint: "Run /atw.build -y to auto-append the marker block, or paste it from the diff above",
                            });
                        }
                        else {
                            await rec.finish(provenanceProjectRoot, { status: "success" });
                        }
                    }
                    catch (err) {
                        log("compose-activate skipped: %s", err.message);
                        await rec.finish(provenanceProjectRoot, {
                            status: "failed",
                            failed_reason: err.message,
                            next_hint: "Open docker-compose.yml manually and confirm the atw:begin/atw:end block, then re-run /atw.build",
                        });
                    }
                }
                else {
                    await rec.finish(provenanceProjectRoot, {
                        status: "skipped",
                        skipped_reason: "no docker-compose.yml in project root",
                        next_hint: "Place a host docker-compose.yml at the project root, then re-run /atw.build",
                    });
                }
            }
            else {
                await rec.finish(provenanceProjectRoot, {
                    status: "not_run",
                    next_hint: flags.entitiesOnly
                        ? "Drop --entities-only to activate compose on the next run"
                        : "Build was aborted before COMPOSE",
                });
            }
        }
        // 9. SCAN -----------------------------------------------------------
        if (!flags.noEnrich && !abortState.aborted) {
            progress.banner(banner("SCAN", "PII compliance scan ..."));
            const scan = await scanPiiLeaks({ schemaMap, connectionConfig });
            complianceScan = {
                ran: true,
                clean: scan.clean,
                values_checked: scan.values_checked,
                matches: scan.matches.map((m) => ({
                    entity_type: m.entity_type,
                    entity_id: m.entity_id,
                    pii_column: m.pii_column,
                    matched_snippet: m.snippet,
                })),
            };
            if (!scan.clean) {
                process.stderr.write(`Compliance scan failed: ${scan.matches.length} PII value(s) leaked. See build-manifest.json.\n`);
            }
        }
        // 10. MANIFEST ------------------------------------------------------
        const completedAt = new Date();
        const result = abortState.aborted
            ? "aborted"
            : !complianceScan.clean
                ? "failed"
                : totals.failed > 0
                    ? "partial"
                    : totals.total_entities === 0 && totals.enriched === 0
                        ? "nothing-to-do"
                        : "success";
        const actualCostUsd = computeCostUsd(opusTotals);
        const manifest = {
            schema_version: "1",
            build_id: buildId,
            started_at: startedAt.toISOString(),
            completed_at: completedAt.toISOString(),
            duration_seconds: (completedAt.getTime() - startedAt.getTime()) / 1000,
            result,
            totals,
            failures,
            opus: {
                calls: opusTotals.calls,
                input_tokens: opusTotals.input_tokens,
                output_tokens: opusTotals.output_tokens,
                cost_usd: actualCostUsd,
                // T071 / US4 — estimate + variance per contracts/manifest.md §2.6.
                // Omit when build-plan.md did not carry an estimate (the zod
                // schema marks both fields optional).
                ...(planSummary.estimatedCostUsd !== null
                    ? {
                        estimated_cost_usd: planSummary.estimatedCostUsd,
                        cost_variance_pct: computeCostVariancePct(actualCostUsd, planSummary.estimatedCostUsd),
                    }
                    : {}),
            },
            // T100 / US9 — surface effective_max and reductions from the
            // runtime controller per contracts/manifest.md §2.7.
            concurrency: {
                configured: concurrency,
                effective_max: concurrencyControllerRef?.effectiveMax ?? concurrency,
                reductions: concurrencyControllerRef
                    ? [...concurrencyControllerRef.reductions]
                    : [],
            },
            input_hashes: hashAllInputs(flags.projectRoot),
            outputs: {
                backend_files: backendFiles,
                widget_bundle: widgetBundle,
                backend_image: backendImage,
            },
            environment: captureEnvironment(),
            compliance_scan: complianceScan,
        };
        const manifestPath = defaultManifestPath(flags.projectRoot);
        writeManifestAtomic(manifestPath, manifest);
        // T065 / US3 — record input hashes for the NEXT run's short-circuit
        // logic. Only do this for clean finishes (success / nothing-to-do); a
        // partial or failed build must not mark inputs as "seen" or the next
        // run would skip work we haven't actually finished.
        if (result === "success" || result === "nothing-to-do") {
            try {
                const sqlDumpRel = await findSqlDumpRelative(flags.projectRoot);
                await writeInputHashes(flags.projectRoot, computeInputHashes(flags.projectRoot, sqlDumpRel, PROMPT_TEMPLATE_VERSION));
            }
            catch (err) {
                log("failed to write input-hashes.json: %s", err.message);
            }
        }
        const exitCode = result === "failed"
            ? 3
            : result === "aborted"
                ? 2
                : result === "partial"
                    ? 1
                    : 0;
        // T072 / US4 — DONE banner surfaces `$actual actual (estimated $X, ±Y%)`
        // so the Builder sees the cost accounting without opening the manifest.
        const costLine = (() => {
            const actualStr = `$${actualCostUsd.toFixed(2)} actual`;
            if (planSummary.estimatedCostUsd === null)
                return actualStr;
            const est = planSummary.estimatedCostUsd;
            const variance = computeCostVariancePct(actualCostUsd, est);
            const sign = variance >= 0 ? "+" : "";
            return `${actualStr} (estimated $${est.toFixed(2)}, ${sign}${variance.toFixed(1)}%)`;
        })();
        // T089 / US7 — the abort banner must tell the Builder exactly how
        // much was spent so far AND how to pick up where they left off, per
        // `contracts/slash-command.md` §5.
        const bannerBody = result === "aborted"
            ? `${completedAt.toISOString()} — $${actualCostUsd.toFixed(2)} spent, resume with /atw.build`
            : `${completedAt.toISOString()} — ${costLine}`;
        progress.banner(banner(result === "aborted" ? "ABORT" : "DONE", bannerBody));
        // FR-028 status-aware summary. The legacy DONE banner above is the
        // build-manifest.json view; this summary surfaces the per-phase
        // status taxonomy from build-provenance.json. Only printed when at
        // least one phase recorded an entry for this build_id.
        const provenanceFile = readProvenance(provenanceProjectRoot);
        const summary = summarizeProvenance(provenanceFile.entries, provenanceBuildId);
        process.stdout.write(`\n${summary}\n`);
        process.removeListener("SIGINT", sigintHandler);
        return { exitCode, manifest };
    }
    catch (err) {
        // T079 / T080 / T081 / US6 — fatal-error diagnostics per
        // `contracts/slash-command.md` §5. Surface one-line Builder-facing
        // text (never a bare stack trace), then write a failed manifest.
        const diag = diagnosticFor(err);
        process.stderr.write(`${diag}\n`);
        log("fatal: %o", err);
        // Attempt to write a failed manifest so downstream tooling has context.
        const completedAt = new Date();
        const manifest = {
            schema_version: "1",
            build_id: buildId,
            started_at: startedAt.toISOString(),
            completed_at: completedAt.toISOString(),
            duration_seconds: (completedAt.getTime() - startedAt.getTime()) / 1000,
            result: "failed",
            totals,
            failures,
            opus: {
                calls: opusTotals.calls,
                input_tokens: opusTotals.input_tokens,
                output_tokens: opusTotals.output_tokens,
                cost_usd: computeCostUsd(opusTotals),
            },
            concurrency: {
                configured: concurrency,
                effective_max: concurrency,
                reductions: [],
            },
            input_hashes: hashAllInputs(flags.projectRoot),
            outputs: {
                backend_files: backendFiles,
                widget_bundle: widgetBundle,
                backend_image: backendImage,
            },
            environment: captureEnvironment(),
            compliance_scan: complianceScan,
        };
        // T100 — if the controller fired any reductions before the fatal
        // error, surface them in the failed-path manifest so the Builder
        // can see what the pipeline tried before giving up.
        if (typeof concurrencyControllerRef !== "undefined" && concurrencyControllerRef) {
            manifest.concurrency.effective_max = concurrencyControllerRef.effectiveMax;
            manifest.concurrency.reductions = [...concurrencyControllerRef.reductions];
        }
        try {
            writeManifestAtomic(defaultManifestPath(flags.projectRoot), manifest);
        }
        catch {
            // swallow — we've already failed
        }
        process.removeListener("SIGINT", sigintHandler);
        return { exitCode: exitCodeFor(err), manifest };
    }
}
/* ---------------------------------------------------------------- helpers -- */
function banner(phase, message) {
    return {
        phase,
        processed: 0,
        total: 0,
        ok: 0,
        skipped: 0,
        failed: 0,
        cost_usd: 0,
        elapsed_seconds: 0,
        eta_seconds: null,
        message,
    };
}
function etaFromRate(processed, total, elapsedSec) {
    if (processed === 0 || elapsedSec <= 0)
        return null;
    const rate = processed / elapsedSec;
    const remaining = total - processed;
    if (remaining <= 0 || rate <= 0)
        return 0;
    return remaining / rate;
}
function classifyFailure(err) {
    // T078 / T084 / US6 — use the error `code` set by callWithHttpRetries
    // so orchestrator-side failure labels are faithful to the HTTP matrix
    // (enrichment.md §5). Message-based fallback preserved for unknown
    // errors from upstream SDKs.
    const code = err?.code;
    if (code === "OPUS_400")
        return "opus_400";
    if (code === "OPUS_5XX_TWICE")
        return "opus_5xx_twice";
    if (code === "VALIDATION_FAILED")
        return "validation_failed_twice";
    const msg = err instanceof Error ? err.message : String(err);
    if (/validation/i.test(msg))
        return "validation_failed_twice";
    if (/missing|not found/i.test(msg))
        return "missing_source_data";
    if (/400|bad request/i.test(msg))
        return "opus_400";
    if (/5\d\d|server error/i.test(msg))
        return "opus_5xx_twice";
    return "opus_400";
}
/**
 * T079 / T080 / T081 / US6 — one-line Builder-facing diagnostic for
 * fatal errors per `contracts/slash-command.md` §5 and FR-085/FR-086.
 */
function diagnosticFor(err) {
    const code = err?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "OPUS_AUTH") {
        return "Anthropic API authentication failed. Set ANTHROPIC_API_KEY in your shell environment and re-run /atw.build.";
    }
    if (code === "OPUS_RATE_LIMIT") {
        return "Anthropic rate limits exhausted even at concurrency=3. Wait a few minutes or raise your account limits.";
    }
    if (code === "PORT_CONFLICT" ||
        code === "EADDRINUSE" ||
        /EADDRINUSE|address already in use|port is already allocated/i.test(msg)) {
        const portMatch = /:?(\d{4,5})/.exec(msg);
        const p = portMatch ? portMatch[1] : String(DEFAULT_POSTGRES_PORT);
        return `Port ${p} is in use by another process. Pass --postgres-port <n> to pick a different port.`;
    }
    if (code === "DOCKER_UNREACHABLE" ||
        (/docker/i.test(msg) &&
            /(not reachable|not running|cannot connect|ECONNREFUSED|ENOENT|unreachable)/i.test(msg))) {
        return "Docker daemon is not reachable. Start Docker Desktop (or your Docker service) and try again.";
    }
    return `atw-orchestrate: ${msg}`;
}
function exitCodeFor(err) {
    const code = err?.code;
    const msg = err instanceof Error ? err.message : String(err);
    if (code === "PORT_CONFLICT" ||
        code === "EADDRINUSE" ||
        /EADDRINUSE|address already in use|port is already allocated/i.test(msg))
        return 4;
    return 3;
}
function schemaArtifactToImport(sm) {
    const included = new Set();
    const piiTables = [];
    const piiColumns = [];
    for (const ent of sm.entities) {
        if (ent.classification === "indexable" || ent.classification === "reference") {
            for (const t of ent.sourceTables)
                included.add(t.toLowerCase());
            for (const c of ent.columns) {
                if (c.decision === "exclude-pii") {
                    for (const t of ent.sourceTables) {
                        piiColumns.push({ table: t.toLowerCase(), column: c.name.toLowerCase() });
                    }
                }
            }
        }
    }
    for (const ex of sm.piiExcluded) {
        if (ex.columns.length === 0)
            piiTables.push(ex.table.toLowerCase());
        for (const col of ex.columns) {
            piiColumns.push({ table: ex.table.toLowerCase(), column: col.toLowerCase() });
        }
    }
    return { includedTables: Array.from(included), piiTables, piiColumns };
}
async function readPlanSummary(projectRoot) {
    const path = join(projectRoot, ".atw", "artifacts", "build-plan.md");
    try {
        const art = await loadArtifactFromFile("build-plan", resolve(path));
        if (art.kind !== "build-plan")
            return { estimatedCostUsd: null, estimatedDurationRange: null };
        const total = art.content.costEstimate.totalCostUsd + art.content.costEstimate.retryBufferUsd;
        return {
            estimatedCostUsd: Number.isFinite(total) ? total : null,
            estimatedDurationRange: null,
        };
    }
    catch (err) {
        log("readPlanSummary failed: %s", err.message);
        return { estimatedCostUsd: null, estimatedDurationRange: null };
    }
}
async function loadSchemaMap(projectRoot) {
    const path = join(projectRoot, ".atw", "artifacts", "schema-map.md");
    const art = await loadArtifactFromFile("schema-map", resolve(path));
    if (art.kind !== "schema-map") {
        throw new Error(`Expected schema-map artifact at ${path}`);
    }
    return art.content;
}
async function findSqlDump(projectRoot) {
    const dir = join(projectRoot, ".atw", "inputs");
    if (!existsSync(dir))
        return null;
    const entries = await fs.readdir(dir);
    const first = entries.find((e) => e.endsWith(".sql") || e.endsWith(".sql.gz"));
    return first ? join(dir, first) : null;
}
async function findSqlDumpRelative(projectRoot) {
    const abs = await findSqlDump(projectRoot);
    if (!abs)
        return null;
    return relative(projectRoot, abs).replace(/\\/g, "/");
}
/**
 * T063 / US3 — pre-flight lookup: returns true iff `atw_documents` already
 * has a row for `(entity_type, entity_id)` whose `source_hash` matches. On
 * any error (table missing, connection hiccup) the check fails open so the
 * caller proceeds with enrichment.
 */
async function existingSourceHashMatches(params) {
    try {
        const { Client } = await import("pg");
        const client = new Client(params.connectionConfig);
        await client.connect();
        try {
            const res = await client.query("SELECT source_hash FROM atw_documents WHERE entity_type = $1 AND entity_id = $2", [params.entity_type, params.entity_id]);
            return (res.rowCount ?? 0) > 0 && res.rows[0].source_hash === params.expected;
        }
        finally {
            await client.end().catch(() => void 0);
        }
    }
    catch (err) {
        log("source-hash pre-check failed: %s", err.message);
        return false;
    }
}
async function listIndexableEntityIds(params) {
    const { Client } = await import("pg");
    const client = new Client(params.connectionConfig);
    await client.connect();
    const out = [];
    try {
        for (const ent of params.schemaMap.entities) {
            if (ent.classification !== "indexable")
                continue;
            const primary = ent.sourceTables[0];
            if (!primary)
                continue;
            try {
                const res = await client.query(`SELECT id::text AS id FROM client_ref."${primary}" ORDER BY id`);
                for (const row of res.rows) {
                    out.push({ type: ent.name, id: row.id });
                }
            }
            catch (err) {
                log("listIndexable skip %s.%s: %s", primary, ent.name, err.message);
            }
        }
    }
    finally {
        await client.end().catch(() => void 0);
    }
    return out;
}
function readProjectName(projectRoot) {
    try {
        const pkg = join(projectRoot, "package.json");
        if (existsSync(pkg)) {
            const parsed = JSON.parse(readFileSync(pkg, "utf8"));
            if (parsed.name)
                return parsed.name;
        }
    }
    catch {
        // fall through
    }
    return "atw-project";
}
function readDefaultLocale(projectRoot) {
    try {
        const cfg = loadProjectConfig({ projectRoot });
        const langs = cfg.languages;
        if (Array.isArray(langs) && typeof langs[0] === "string" && langs[0]) {
            return langs[0];
        }
    }
    catch {
        // fall through
    }
    return "en";
}
function readBriefSummary(projectRoot) {
    try {
        const briefPath = join(projectRoot, ".atw", "config", "brief.md");
        if (!existsSync(briefPath))
            return "";
        const raw = readFileSync(briefPath, "utf8");
        const scopeMatch = raw.match(/##\s+Business scope\s*\n+([\s\S]*?)(?=\n##\s|$)/);
        const text = (scopeMatch?.[1] ?? raw).trim();
        return text.length > 800 ? text.slice(0, 800).trimEnd() + "..." : text;
    }
    catch {
        return "";
    }
}
export function generateBuildId(nowMs = Date.now()) {
    const iso = new Date(nowMs).toISOString();
    const compact = iso.replace(/[-:]/g, "").replace(/\.\d+Z$/, "").replace("T", "T");
    const hex = randomBytes(2).toString("hex");
    return `atw-build-${compact}-${hex}`;
}
/**
 * Crockford-base32 ULID generator (FR-028 / build-provenance schema).
 * Uses a 48-bit timestamp + 80 bits of randomness; total 26 chars from
 * alphabet `0-9 A-Z` excluding `I L O U`. Matches the regex enforced by
 * `BuildProvenanceEntrySchema`.
 */
const ULID_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
export function generateUlid(nowMs = Date.now()) {
    const time = encodeUlidTime(nowMs);
    const rand = randomBytes(10);
    let body = "";
    for (let i = 0; i < 16; i++) {
        body += ULID_ALPHABET[fiveBitsAt(rand, i)];
    }
    return time + body;
}
function encodeUlidTime(ms) {
    let v = ms;
    const out = new Array(10);
    for (let i = 9; i >= 0; i--) {
        out[i] = ULID_ALPHABET[v & 31];
        v = Math.floor(v / 32);
    }
    return out.join("");
}
function fiveBitsAt(buf, index) {
    // Treat the 80 random bits as a contiguous bitstream and read 5 bits at
    // `index * 5` from the MSB. We have 80 bits = 10 bytes = 16 5-bit groups.
    const bitStart = index * 5;
    const byteStart = Math.floor(bitStart / 8);
    const bitOffset = bitStart % 8;
    const high = buf[byteStart] ?? 0;
    const low = buf[byteStart + 1] ?? 0;
    const combined = (high << 8) | low;
    return (combined >>> (11 - bitOffset)) & 0b11111;
}
function missingArtifacts(projectRoot) {
    const missing = [];
    for (const rel of REQUIRED_ARTIFACTS) {
        const abs = join(projectRoot, rel);
        if (!existsSync(abs))
            missing.push(rel);
    }
    return missing;
}
function hashAllInputs(projectRoot) {
    const out = {};
    for (const rel of REQUIRED_ARTIFACTS) {
        const abs = join(projectRoot, rel);
        if (existsSync(abs)) {
            try {
                const h = createHash("sha256").update(readFileSync(abs)).digest("hex");
                out[rel.split("/").pop()] = "sha256:" + h;
            }
            catch {
                // skip
            }
        }
    }
    out["prompt_template_version"] = PROMPT_TEMPLATE_VERSION;
    return out;
}
function captureEnvironment() {
    return {
        platform: `${process.platform}-${process.arch}`,
        node_version: process.versions.node,
        docker_server_version: "unknown",
        postgres_image_digest: "unknown",
        embedding_model: DEFAULT_EMBEDDING_MODEL,
    };
}
function printHelp() {
    process.stdout.write([
        "atw-orchestrate — AI to Widget build orchestrator",
        "",
        "Usage:",
        "  atw-orchestrate [--force] [--dry-run] [--concurrency N]",
        "                  [--postgres-port N] [--entities-only] [--no-enrich]",
        "                  [--skip-image] [--backup] [--yes] [--help] [--version]",
        "",
        "Runs the full build pipeline documented in /atw.build.",
        "",
        "Flags:",
        "  --skip-image    Suppress the IMAGE step (no Docker build).",
        "",
    ].join("\n"));
}
function printVersion() {
    process.stdout.write("atw-orchestrate 0.1.0\n");
}
/**
 * Parse argv into OrchestratorFlags. Shared by the CLI shim and by tests.
 */
export function parseArgs(argv, projectRoot) {
    const flags = { projectRoot };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        switch (a) {
            case "--force":
                flags.force = true;
                break;
            case "--dry-run":
                flags.dryRun = true;
                break;
            case "--entities-only":
                flags.entitiesOnly = true;
                break;
            case "--no-enrich":
                flags.noEnrich = true;
                break;
            case "--skip-image":
                flags.skipImage = true;
                break;
            case "--backup":
                flags.backup = true;
                break;
            case "--yes":
            case "-y":
                flags.yes = true;
                break;
            case "--help":
            case "-h":
                flags.help = true;
                break;
            case "--version":
            case "-v":
                flags.version = true;
                break;
            case "--concurrency": {
                const next = argv[++i];
                const n = Number.parseInt(next ?? "", 10);
                if (!Number.isFinite(n) || n < 1) {
                    throw new Error("--concurrency requires a positive integer");
                }
                flags.concurrency = n;
                break;
            }
            case "--postgres-port": {
                const next = argv[++i];
                const n = Number.parseInt(next ?? "", 10);
                if (!Number.isFinite(n) || n < 1 || n > 65535) {
                    throw new Error("--postgres-port requires a port in 1..65535");
                }
                flags.postgresPort = n;
                break;
            }
            default:
                throw new Error(`Unknown flag: ${a}`);
        }
    }
    return flags;
}
// Silence unused-import warnings; these two are exported for test injection
// elsewhere but not referenced inside this module.
export { formatLine };
/**
 * Hashes the inputs that determine RENDER output: project name, the
 * action manifest, and the contents of the templates directory. Used by
 * T043 to short-circuit RENDER when nothing has changed since the last
 * successful build (FR-008b).
 */
async function computeRenderInputHashes(args) {
    const fsMod = await import("node:fs/promises");
    const pathMod = await import("node:path");
    const emptySha = createHash("sha256").update("").digest("hex");
    const manifestSha = (await safeFileSha(fsMod, args.manifestPath)) ?? emptySha;
    const projectName = readProjectName(args.projectRoot);
    let templatesSha = emptySha;
    try {
        const entries = await fsMod.readdir(args.templatesDir, { withFileTypes: true });
        const hasher = createHash("sha256");
        for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
            if (!e.isFile())
                continue;
            const buf = await fsMod.readFile(pathMod.join(args.templatesDir, e.name));
            hasher.update(e.name);
            hasher.update(" ");
            hasher.update(buf);
        }
        templatesSha = hasher.digest("hex");
    }
    catch {
        templatesSha = emptySha;
    }
    return {
        project_name_sha256: createHash("sha256").update(projectName).digest("hex"),
        action_manifest_sha256: manifestSha,
        backend_templates_sha256: templatesSha,
    };
}
async function safeFileSha(fsMod, filePath) {
    try {
        const buf = await fsMod.readFile(filePath);
        return createHash("sha256").update(buf).digest("hex");
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=orchestrator.js.map