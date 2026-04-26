/**
 * Embed-guide placeholder lint (FR-013, SC-006). Used by both build-time
 * template validation (T060) and the FR-035 CI regression harness.
 *
 * The lint asserts that the rendered `embed-guide.md` (and the four
 * source `.hbs` templates) contain none of:
 *   - `<your storefront origin>` placeholder
 *   - `[NEEDS CLARIFICATION]` markers
 *   - `specs/` repo-internal path leaks
 *   - bare `localhost` outside an explicit `REPLACE THIS` annotation
 *
 * The function returns the offending matches; an empty result means
 * clean. The caller decides whether to fail (build-time, CI) or warn.
 */

export interface LintMatch {
  line: number;
  pattern: string;
  excerpt: string;
}

export interface LintOptions {
  /** When true, treat `localhost` outside REPLACE-THIS as an offence. */
  allowLocalhost?: boolean;
}

const PATTERNS: Array<{ name: string; rx: RegExp }> = [
  { name: "placeholder:<your storefront origin>", rx: /<your storefront origin>/i },
  { name: "marker:NEEDS_CLARIFICATION", rx: /\[NEEDS CLARIFICATION\]/ },
  { name: "leak:specs/", rx: /specs\/[a-z0-9-]+\//i },
];

const LOCALHOST_RX = /localhost/i;
const REPLACE_HINT_RX = /REPLACE THIS/;

export function lintEmbedGuide(content: string, opts: LintOptions = {}): LintMatch[] {
  const matches: LintMatch[] = [];
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNo = i + 1;
    for (const { name, rx } of PATTERNS) {
      if (rx.test(line)) {
        matches.push({ line: lineNo, pattern: name, excerpt: line.trim() });
      }
    }
    if (!opts.allowLocalhost && LOCALHOST_RX.test(line)) {
      // Only count it as a leak if the same line OR the previous two lines
      // do NOT mention REPLACE THIS — that's the documented escape hatch
      // for the embed templates.
      const window = lines.slice(Math.max(0, i - 2), i + 1).join("\n");
      if (!REPLACE_HINT_RX.test(window)) {
        matches.push({
          line: lineNo,
          pattern: "leak:bare-localhost",
          excerpt: line.trim(),
        });
      }
    }
  }
  return matches;
}

export function formatMatches(matches: ReadonlyArray<LintMatch>): string {
  return matches
    .map((m) => `  L${m.line}  [${m.pattern}]  ${m.excerpt}`)
    .join("\n");
}
