import { promises as fs } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import Debug from "debug";

const log = Debug("atw:build-backend-image");

export interface BuildImageResult {
  image_id: string;
  ref: string;
  size_bytes: number;
}

export interface BuildImageOptions {
  contextDir: string;
  dockerfile?: string;
  tag?: string;
  labels?: Record<string, string>;
}

const DEFAULT_TAG = "atw_backend:latest";

/**
 * Build the backend image via dockerode. Pre-flight guard: if the build
 * context contains a file named `.env` or `*.pem` we refuse to proceed to
 * avoid shipping secrets into the runtime image (FR-077 guard).
 */
export async function buildBackendImage(
  opts: BuildImageOptions,
): Promise<BuildImageResult> {
  const tag = opts.tag ?? DEFAULT_TAG;
  await assertNoSecretsInContext(opts.contextDir);

  const { default: Docker } = await import("dockerode");
  const docker = new Docker();
  try {
    await docker.ping();
  } catch (err) {
    const e = new Error("Docker daemon unreachable");
    (e as { code?: string }).code = "DOCKER_UNREACHABLE";
    (e as { cause?: unknown }).cause = err;
    throw e;
  }

  const tar = await collectBuildContext(opts.contextDir);
  const stream = await docker.buildImage(tar, {
    t: tag,
    dockerfile: opts.dockerfile ?? "Dockerfile",
    labels: opts.labels ?? { "io.atw.feature": "002-build-pipeline" },
  });

  let lastError: string | null = null;
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream as NodeJS.ReadableStream,
      (err) => (err ? reject(err) : resolve()),
      (evt: { stream?: string; errorDetail?: { message?: string }; error?: string }) => {
        if (evt.error) lastError = evt.error;
        if (evt.errorDetail?.message) lastError = evt.errorDetail.message;
        if (evt.stream) log(evt.stream.trimEnd());
      },
    );
  });
  if (lastError) {
    const e = new Error(`docker build failed: ${lastError}`);
    (e as { code?: string }).code = "DOCKER_BUILD";
    throw e;
  }

  const images = await docker.listImages({ filters: { reference: [tag] } });
  if (images.length === 0) {
    throw new Error(`image ${tag} not found after build`);
  }
  const info = images[0];
  return { image_id: info.Id, ref: tag, size_bytes: info.Size };
}

async function assertNoSecretsInContext(dir: string): Promise<void> {
  const offenders: string[] = [];
  const walk = async (d: string, rel: string): Promise<void> => {
    const items = await fs.readdir(d, { withFileTypes: true });
    for (const item of items) {
      if (item.name === "node_modules" || item.name === ".git" || item.name === "dist")
        continue;
      const abs = path.join(d, item.name);
      const relp = rel ? `${rel}/${item.name}` : item.name;
      if (item.isDirectory()) {
        await walk(abs, relp);
        continue;
      }
      if (/^\.env(\..+)?$/.test(item.name)) offenders.push(relp);
      if (/\.(pem|p12|pfx|key)$/.test(item.name)) offenders.push(relp);
      if (item.name === "id_rsa" || item.name === "id_ed25519") offenders.push(relp);
    }
  };
  await walk(dir, "");
  if (offenders.length > 0) {
    const e = new Error(
      `refusing to build: secret-shaped files in build context: ${offenders.join(", ")}`,
    );
    (e as { code?: string }).code = "SECRET_IN_CONTEXT";
    throw e;
  }
}

async function collectBuildContext(dir: string): Promise<NodeJS.ReadableStream> {
  const tar = await import("tar-fs").catch(() => null);
  if (!tar) {
    throw new Error(
      "tar-fs is required to build docker images. Install it as a dependency of @atw/scripts.",
    );
  }
  const ignore = (name: string): boolean => {
    const lower = name.toLowerCase();
    if (lower.includes("node_modules")) return true;
    if (lower.includes(".git")) return true;
    if (lower.endsWith(".bak")) return true;
    return false;
  };
  return (tar as unknown as { pack: (d: string, opts: { ignore: (n: string) => boolean }) => NodeJS.ReadableStream }).pack(dir, {
    ignore,
  });
}

/* ------------------------------------------------------------------ CLI -- */

interface CliOptions {
  contextDir: string;
  dockerfile: string;
  tag: string;
  json: boolean;
}

function parseCli(argv: string[]): CliOptions | { help: true } | { version: true } {
  const { values } = parseArgs({
    args: argv,
    options: {
      "context-dir": { type: "string" },
      dockerfile: { type: "string" },
      tag: { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false, short: "h" },
      version: { type: "boolean", default: false, short: "v" },
    },
    strict: true,
  });
  if (values.help) return { help: true };
  if (values.version) return { version: true };
  return {
    contextDir: String(values["context-dir"] ?? path.resolve(process.cwd(), "packages", "backend")),
    dockerfile: String(values.dockerfile ?? "Dockerfile"),
    tag: String(values.tag ?? DEFAULT_TAG),
    json: Boolean(values.json),
  };
}

export async function runBuildBackendImage(argv: string[]): Promise<number> {
  let opts: CliOptions | { help: true } | { version: true };
  try {
    opts = parseCli(argv);
  } catch (err) {
    process.stderr.write(`atw-build-backend-image: ${(err as Error).message}\n`);
    return 3;
  }
  if ("help" in opts) {
    process.stdout.write(
      "atw-build-backend-image [--context-dir <p>] [--dockerfile <p>] [--tag <ref>] [--json]\n",
    );
    return 0;
  }
  if ("version" in opts) {
    process.stdout.write("atw-build-backend-image 0.1.0\n");
    return 0;
  }

  try {
    const result = await buildBackendImage({
      contextDir: opts.contextDir,
      dockerfile: opts.dockerfile,
      tag: opts.tag,
    });
    if (opts.json) {
      process.stdout.write(JSON.stringify(result) + "\n");
    } else {
      process.stdout.write(`built ${result.ref} (${result.image_id}, ${result.size_bytes}B)\n`);
    }
    return 0;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "DOCKER_UNREACHABLE") {
      process.stderr.write(
        "atw-build-backend-image: Docker daemon unreachable. Start Docker Desktop (macOS/Windows) or `systemctl start docker` (Linux).\n",
      );
      return 3;
    }
    if (code === "DOCKER_BUILD") {
      process.stderr.write(`atw-build-backend-image: ${(err as Error).message}\n`);
      return 19;
    }
    if (code === "SECRET_IN_CONTEXT") {
      process.stderr.write(`atw-build-backend-image: ${(err as Error).message}\n`);
      return 20;
    }
    process.stderr.write(`atw-build-backend-image: ${(err as Error).message}\n`);
    return 1;
  }
}
