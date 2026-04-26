import { describe, it, expect } from "vitest";
import { validateTemplates } from "../src/lib/validate-templates.js";

/**
 * T060 — every Handlebars template ships compilable + renderable
 * against a canonical fixture context. This test catches the parse-error
 * class regression observed in 009 (e.g. a stray `{{/if}}}` reading as
 * `}}}` triple-stash close) before publish.
 */
describe("validate-templates (T060 / FR-036)", () => {
  it("compiles and renders every backend + embed template", async () => {
    const result = await validateTemplates({ runTsc: false });
    if (!result.ok) {
      const summary = result.issues
        .map((i) => `[${i.phase}] ${i.file}: ${i.message}`)
        .join("\n");
      throw new Error(`validateTemplates reported issues:\n${summary}`);
    }
    expect(result.ok).toBe(true);
    expect(result.rendered).toBeGreaterThan(0);
    expect(result.issues).toEqual([]);
  });
});
