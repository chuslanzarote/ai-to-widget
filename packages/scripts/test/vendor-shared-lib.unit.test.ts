/**
 * T009 / US1 — unit test for vendor-shared-lib.
 *
 * Contract (contracts/vendor-shared-lib.md, data-model.md Entity 5):
 *   - Copies only files listed in SHARED_LIB_ALLOWLIST, from a source dir
 *     of real `.ts` files, into `<projectRoot>/backend/src/_shared/`.
 *   - A request to vendor a file whose name is NOT in the allowlist but
 *     IS in `referencedNames` raises `VENDOR_NOT_ALLOWED`.
 *   - sha256/bytes on the emitted record match the on-disk file.
 *   - `collectReferencedSharedNames` finds `_shared/<name>.js` specifiers.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import {
  vendorSharedLib,
  collectReferencedSharedNames,
} from "../src/vendor-shared-lib.js";
import { SHARED_LIB_ALLOWLIST } from "../src/_shared-lib-allowlist.js";

async function sha256(p: string): Promise<string> {
  const buf = await fs.readFile(p);
  return createHash("sha256").update(buf).digest("hex");
}

describe("vendor-shared-lib (T009 / US1)", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-vendor-"));
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  async function makeSharedSrc(): Promise<string> {
    const srcDir = path.join(tmp, "src-lib");
    await fs.mkdir(srcDir, { recursive: true });
    for (const name of SHARED_LIB_ALLOWLIST) {
      await fs.writeFile(path.join(srcDir, name), `// stub ${name}\n`);
    }
    // Plant a non-allowlisted extra that must NOT be copied.
    await fs.writeFile(path.join(srcDir, "forbidden.ts"), "// never\n");
    return srcDir;
  }

  it("copies every allowlisted file and ignores non-allowlisted files", async () => {
    const srcDir = await makeSharedSrc();
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    const results = await vendorSharedLib({ projectRoot, sourceDir: srcDir });
    const names = results.map((r) => r.path.split("/").pop()).sort();
    expect(names).toEqual([...SHARED_LIB_ALLOWLIST].sort());
    const forbidden = path.join(
      projectRoot,
      "backend",
      "src",
      "_shared",
      "forbidden.ts",
    );
    await expect(fs.access(forbidden)).rejects.toThrow();
  });

  it("sha256 of each result matches the on-disk vendored file", async () => {
    const srcDir = await makeSharedSrc();
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    const results = await vendorSharedLib({ projectRoot, sourceDir: srcDir });
    for (const r of results) {
      const onDisk = await sha256(path.join(projectRoot, r.path));
      expect(r.sha256).toBe(onDisk);
    }
  });

  it("raises VENDOR_NOT_ALLOWED when referencedNames includes a non-allowlisted name", async () => {
    const srcDir = await makeSharedSrc();
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    await expect(
      vendorSharedLib({
        projectRoot,
        sourceDir: srcDir,
        referencedNames: ["forbidden"],
      }),
    ).rejects.toMatchObject({ code: "VENDOR_NOT_ALLOWED" });
  });

  it("tags unchanged on byte-identical second run", async () => {
    const srcDir = await makeSharedSrc();
    const projectRoot = path.join(tmp, "proj");
    await fs.mkdir(projectRoot, { recursive: true });
    await vendorSharedLib({ projectRoot, sourceDir: srcDir });
    const second = await vendorSharedLib({ projectRoot, sourceDir: srcDir });
    for (const r of second) expect(r.action).toBe("unchanged");
  });

  it("collectReferencedSharedNames finds _shared/<name>.js specifiers", async () => {
    const backendSrc = path.join(tmp, "backend-src");
    await fs.mkdir(path.join(backendSrc, "lib"), { recursive: true });
    await fs.writeFile(
      path.join(backendSrc, "index.ts"),
      `import { a } from "./_shared/types.js";\n`,
    );
    await fs.writeFile(
      path.join(backendSrc, "lib", "x.ts"),
      `import { b } from "../_shared/runtime-logger.js";\n`,
    );
    // Non-matching imports should be ignored.
    await fs.writeFile(
      path.join(backendSrc, "lib", "y.ts"),
      `import foo from "pg";\nimport bar from "./other.js";\n`,
    );
    const names = await collectReferencedSharedNames(backendSrc);
    expect(names).toEqual(["runtime-logger", "types"]);
  });
});
