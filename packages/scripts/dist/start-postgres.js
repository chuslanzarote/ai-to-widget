import { parseArgs } from "node:util";
import Debug from "debug";
const log = Debug("atw:start-postgres");
const DEFAULT_IMAGE = "pgvector/pgvector:pg16";
const DEFAULT_PORT = 5433;
const DEFAULT_WAIT_SECONDS = 60;
const DEFAULT_CONTAINER_NAME = "atw_postgres";
const DEFAULT_DB = "atw";
const DEFAULT_USER = "atw";
const DEFAULT_PASSWORD = "atw";
/**
 * Start the atw_postgres container using dockerode. No-op when already
 * running. Resolves once Postgres is accepting TCP connections or rejects
 * when the wait deadline elapses.
 *
 * Contract: contracts/scripts.md §1.
 */
export async function startPostgres(opts = {}) {
    const port = opts.port ?? DEFAULT_PORT;
    const waitSeconds = opts.waitSeconds ?? DEFAULT_WAIT_SECONDS;
    const image = opts.image ?? DEFAULT_IMAGE;
    const name = opts.containerName ?? DEFAULT_CONTAINER_NAME;
    const db = opts.db ?? DEFAULT_DB;
    const user = opts.user ?? DEFAULT_USER;
    const password = opts.password ?? DEFAULT_PASSWORD;
    log("starting %s -> host port %d", image, port);
    // Lazy-load dockerode so --help / parse errors don't require the daemon.
    const { default: Docker } = await import("dockerode");
    const docker = new Docker();
    // Probe daemon reachability early.
    try {
        await docker.ping();
    }
    catch (err) {
        const e = new Error("Docker daemon unreachable");
        e.code = "DOCKER_UNREACHABLE";
        e.cause = err;
        throw e;
    }
    const existing = await findContainerByName(docker, name);
    if (existing) {
        const info = await existing.inspect();
        if (info.State.Running) {
            log("container %s already running", name);
            await waitForAccept(port, waitSeconds);
            return { container_id: info.Id, port, started: false };
        }
        log("container %s exists but not running — starting", name);
        await existing.start();
        await waitForAccept(port, waitSeconds);
        return { container_id: info.Id, port, started: true };
    }
    try {
        await ensureImage(docker, image);
    }
    catch (err) {
        log("image pull failed: %o", err);
        throw err;
    }
    const container = await docker.createContainer({
        name,
        Image: image,
        Env: [`POSTGRES_DB=${db}`, `POSTGRES_USER=${user}`, `POSTGRES_PASSWORD=${password}`],
        HostConfig: {
            PortBindings: { "5432/tcp": [{ HostPort: String(port) }] },
            RestartPolicy: { Name: "unless-stopped" },
        },
        ExposedPorts: { "5432/tcp": {} },
    });
    try {
        await container.start();
    }
    catch (err) {
        const msg = err.message ?? "";
        if (/port is already allocated|address already in use/i.test(msg)) {
            const e = new Error(`Port ${port} is already allocated`);
            e.code = "PORT_CONFLICT";
            throw e;
        }
        throw err;
    }
    await waitForAccept(port, waitSeconds);
    const info = await container.inspect();
    return { container_id: info.Id, port, started: true };
}
async function findContainerByName(docker, name) {
    const list = await docker.listContainers({ all: true, filters: { name: [name] } });
    if (list.length === 0)
        return null;
    return docker.getContainer(list[0].Id);
}
async function ensureImage(docker, image) {
    const existing = await docker.listImages({ filters: { reference: [image] } });
    if (existing.length > 0)
        return;
    log("pulling image %s", image);
    const stream = await docker.pull(image);
    await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, (err) => err ? reject(err) : resolve());
    });
}
async function waitForAccept(port, waitSeconds) {
    const net = await import("node:net");
    const deadline = Date.now() + waitSeconds * 1000;
    let lastError = null;
    while (Date.now() < deadline) {
        try {
            await new Promise((resolve, reject) => {
                const sock = net.createConnection({ host: "127.0.0.1", port });
                sock.once("connect", () => {
                    sock.end();
                    resolve();
                });
                sock.once("error", (err) => {
                    sock.destroy();
                    reject(err);
                });
            });
            return;
        }
        catch (err) {
            lastError = err;
            await new Promise((r) => setTimeout(r, 500));
        }
    }
    const e = new Error(`Postgres did not accept connections within ${waitSeconds}s: ${lastError?.message ?? "unknown"}`);
    e.code = "WAIT_TIMEOUT";
    throw e;
}
function parseCli(argv) {
    const { values } = parseArgs({
        args: argv,
        options: {
            port: { type: "string" },
            "wait-seconds": { type: "string" },
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
    const port = values.port ? Number.parseInt(String(values.port), 10) : DEFAULT_PORT;
    if (!Number.isFinite(port) || port < 1 || port > 65535) {
        throw new Error("--port requires an integer in 1..65535");
    }
    const waitSeconds = values["wait-seconds"]
        ? Number.parseInt(String(values["wait-seconds"]), 10)
        : DEFAULT_WAIT_SECONDS;
    if (!Number.isFinite(waitSeconds) || waitSeconds < 1) {
        throw new Error("--wait-seconds requires a positive integer");
    }
    return { port, waitSeconds, json: Boolean(values.json) };
}
export async function runStartPostgres(argv) {
    let opts;
    try {
        opts = parseCli(argv);
    }
    catch (err) {
        process.stderr.write(`atw-start-postgres: ${err.message}\n`);
        return 3;
    }
    if ("help" in opts) {
        process.stdout.write("atw-start-postgres [--port <n>] [--wait-seconds <n>] [--json]\n" +
            "  Boots the pgvector/pgvector:pg16 container (no-op if running).\n");
        return 0;
    }
    if ("version" in opts) {
        process.stdout.write("atw-start-postgres 0.1.0\n");
        return 0;
    }
    try {
        const result = await startPostgres({ port: opts.port, waitSeconds: opts.waitSeconds });
        if (opts.json) {
            process.stdout.write(JSON.stringify(result) + "\n");
        }
        else {
            process.stdout.write(`Postgres ready on 127.0.0.1:${result.port} (${result.started ? "started" : "already running"})\n`);
        }
        return 0;
    }
    catch (err) {
        const code = err.code;
        const msg = err.message ?? String(err);
        if (code === "DOCKER_UNREACHABLE") {
            process.stderr.write("atw-start-postgres: Docker daemon unreachable. Start Docker Desktop (macOS/Windows) or `systemctl start docker` (Linux).\n");
            return 3;
        }
        if (code === "PORT_CONFLICT") {
            process.stderr.write(`atw-start-postgres: ${msg}. Retry with --port <free> or stop the occupant.\n`);
            return 4;
        }
        process.stderr.write(`atw-start-postgres: ${msg}\n`);
        return 1;
    }
}
//# sourceMappingURL=start-postgres.js.map