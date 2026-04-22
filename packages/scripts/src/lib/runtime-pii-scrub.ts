/**
 * Defence-in-depth PII scrubber shared between the rendered backend
 * (`packages/backend/src/lib/pii-scrub.ts` after Feature 002 render) and
 * its unit tests.
 *
 * Source: specs/003-runtime/research §7 + FR-038.
 */
const REPLACEMENT = "[redacted]";

const PATTERNS: Array<{ name: string; regex: RegExp }> = [
  {
    name: "email",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  },
  {
    // International phone numbers with optional country code and separators.
    name: "phone",
    regex: /\+\d{1,3}[ .-]\d{2,4}[ .-]\d{2,4}[ .-]\d{2,4}/g,
  },
  {
    // 13-19 digit runs — covers most PANs.
    name: "card",
    regex: /\b(?:\d[ -]?){12,18}\d\b/g,
  },
  {
    // IBAN: 2 letters + 2 digits + up to 30 alphanumerics.
    name: "iban",
    regex: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
  },
];

export interface ScrubResult {
  text: string;
  redactions: number;
}

export function scrubPii(input: string): ScrubResult {
  let text = input;
  let redactions = 0;
  for (const { regex } of PATTERNS) {
    text = text.replace(regex, () => {
      redactions += 1;
      return REPLACEMENT;
    });
  }
  return { text, redactions };
}
