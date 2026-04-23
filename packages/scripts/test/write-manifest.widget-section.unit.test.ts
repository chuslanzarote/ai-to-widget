import { describe, it, expect } from "vitest";
import {
  buildWidgetManifestSection,
  type WidgetManifestSection,
} from "../src/write-manifest.js";
import type { CompileResult } from "../src/compile-widget.js";

describe("buildWidgetManifestSection (T016 / US3)", () => {
  const fakeCompile: CompileResult = {
    js: {
      path: "dist/widget.js",
      bytes: 47218,
      gzip_bytes: 17094,
      sha256: "d".repeat(64),
    },
    css: {
      path: "dist/widget.css",
      bytes: 9844,
      gzip_bytes: 2811,
      sha256: "c".repeat(64),
    },
    source: {
      package_version: "0.1.0",
      tree_hash: "sha256:" + "a".repeat(64),
    },
  };

  it("produces a fully typed section matching the contract (INV-1)", () => {
    const section: WidgetManifestSection = buildWidgetManifestSection(
      fakeCompile,
      fakeCompile.source,
    );
    expect(section.js).toEqual({
      path: "dist/widget.js",
      bytes: 47218,
      gzip_bytes: 17094,
      sha256: "d".repeat(64),
    });
    expect(section.css).toEqual({
      path: "dist/widget.css",
      bytes: 9844,
      gzip_bytes: 2811,
      sha256: "c".repeat(64),
    });
    expect(section.source).toEqual({
      package_version: "0.1.0",
      tree_hash: "sha256:" + "a".repeat(64),
    });
  });

  it("never matches the Feature 003 stub sha256 (INV-4)", async () => {
    const { createHash } = await import("node:crypto");
    const stubString =
      "/* atw widget: no-op bundle (Feature 003 populates later) */\n";
    const stubSha = createHash("sha256").update(stubString).digest("hex");
    const section = buildWidgetManifestSection(fakeCompile, fakeCompile.source);
    expect(section.js.sha256).not.toBe(stubSha);
  });
});
