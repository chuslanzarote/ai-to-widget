import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { verifyBriefAnchoring } from "../../packages/scripts/src/lib/brief-synthesis.js";
import { writeArtifactAtomic } from "../../packages/scripts/src/lib/atomic.js";
import { serializeArtifact, parseMarkdown, parseArtifactFromMarkdown } from "../../packages/scripts/src/lib/markdown.js";
import type { BriefArtifact } from "../../packages/scripts/src/lib/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturePath = path.resolve(__dirname, "..", "fixtures", "aurelia", "brief-answers.json");

describe("atw.brief: anchored synthesis against Aurelia fixture", () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await fs.mkdtemp(path.join(os.tmpdir(), "atw-brief-"));
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it("writes a brief whose every heading matches the canonical structure", async () => {
    const answers = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    const draft: BriefArtifact = {
      businessScope: answers.businessScope,
      customers: answers.customers,
      allowedActions: answers.allowedActions,
      forbiddenActions: answers.forbiddenActions,
      tone: answers.tone,
      primaryUseCases: answers.primaryUseCases,
      vocabulary: answers.vocabulary,
      antiPatterns: answers.antiPatterns,
    };

    const briefPath = path.join(tmp, ".atw", "config", "brief.md");
    await writeArtifactAtomic(briefPath, serializeArtifact("brief", draft));

    const raw = await fs.readFile(briefPath, "utf8");
    const loaded = parseArtifactFromMarkdown("brief", parseMarkdown(raw));

    expect(loaded.businessScope).toContain("ceramic");
    expect(loaded.allowedActions.length).toBe(answers.allowedActions.length);
    expect(loaded.forbiddenActions.length).toBe(answers.forbiddenActions.length);
    expect(loaded.vocabulary.map((v) => v.term)).toContain("slip-cast");
  });

  it("anchoring verifier flags an unanchored claim injected into the draft (FR-013)", async () => {
    const answers = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    const tamperedDraft: BriefArtifact = {
      ...answers,
      // Unanchored sentence — none of these domain tokens appear in Aurelia answers.
      businessScope: `${answers.businessScope} Aurelia also runs a blockchain marketplace for synthetic diamond NFTs.`,
    };
    const report = verifyBriefAnchoring(tamperedDraft, answers);
    expect(report.valid).toBe(false);
    expect(report.unsupportedClaims.some((c) => /blockchain|diamond|nft/i.test(c))).toBe(true);
  });

  it("anchoring verifier accepts a draft built only from the fixture", async () => {
    const answers = JSON.parse(await fs.readFile(fixturePath, "utf8"));
    const draft: BriefArtifact = { ...answers };
    const report = verifyBriefAnchoring(draft, answers);
    expect(report.valid).toBe(true);
  });
});
