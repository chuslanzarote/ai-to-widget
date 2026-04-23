import { describe, it, expect } from "vitest";
import path from "node:path";
import { resolveWidgetSource } from "../src/compile-widget.js";

describe("resolveWidgetSource (T005 / US1)", () => {
  it("returns the workspace @atw/widget/src/index.ts entry", () => {
    const source = resolveWidgetSource();
    expect(source.entry).toMatch(/widget[\\/]src[\\/]index\.ts$/);
    expect(source.widgetRoot).toMatch(/widget$/);
    expect(source.packageVersion).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("entry resolves under packages/widget in the monorepo", () => {
    const source = resolveWidgetSource();
    const normalized = source.widgetRoot.split(path.sep).join("/");
    expect(normalized).toMatch(/\/packages\/widget$/);
  });
});
