import type { BriefArtifact } from "./types.js";

export interface BriefAnchorReport {
  valid: boolean;
  unsupportedClaims: string[];
}

export interface BriefAnchorOptions {
  /** Minimum token overlap (case-insensitive content words) required to count a sentence as supported. */
  minOverlap?: number;
  /** Additional Builder statements beyond the structured answers (e.g., mid-interview clarifications). */
  extraBuilderStatements?: readonly string[];
}

/**
 * Checks that every sentence in a synthesized draft is traceable to a
 * Builder statement captured by `/atw.brief`. Returns a report listing
 * unsupported sentences so the command can ask the Builder to resolve.
 *
 * Anchoring rule from FR-013 / Principle V: the draft must not introduce
 * customers, actions, vocabulary, or anti-patterns that the Builder did
 * not state. This helper is the verification routine, not the synthesis
 * prompt itself.
 */
export function verifyBriefAnchoring(
  draft: BriefArtifact,
  answers: BriefAnswers,
  options: BriefAnchorOptions = {},
): BriefAnchorReport {
  const corpus = collectCorpus(answers, options.extraBuilderStatements ?? []);
  const minOverlap = options.minOverlap ?? 3;

  const unsupported: string[] = [];
  for (const sentence of extractClaims(draft)) {
    if (!isSupported(sentence, corpus, minOverlap)) {
      unsupported.push(sentence);
    }
  }
  return { valid: unsupported.length === 0, unsupportedClaims: unsupported };
}

export interface BriefAnswers {
  businessScope: string;
  customers: string;
  allowedActions: string[];
  forbiddenActions: string[];
  tone: string;
  primaryUseCases: string[];
  vocabulary: { term: string; definition: string }[];
  antiPatterns?: string[];
}

function collectCorpus(answers: BriefAnswers, extras: readonly string[]): Set<string> {
  const tokens = new Set<string>();
  const ingest = (text: string): void => {
    for (const t of tokenize(text)) tokens.add(t);
  };
  ingest(answers.businessScope);
  ingest(answers.customers);
  ingest(answers.tone);
  for (const a of answers.allowedActions) ingest(a);
  for (const a of answers.forbiddenActions) ingest(a);
  for (const u of answers.primaryUseCases) ingest(u);
  for (const v of answers.vocabulary) {
    ingest(v.term);
    ingest(v.definition);
  }
  for (const p of answers.antiPatterns ?? []) ingest(p);
  for (const x of extras) ingest(x);
  return tokens;
}

function extractClaims(draft: BriefArtifact): string[] {
  const sentences: string[] = [];
  pushSentences(sentences, draft.businessScope);
  pushSentences(sentences, draft.customers);
  pushSentences(sentences, draft.tone);
  for (const a of draft.allowedActions) pushSentences(sentences, a);
  for (const a of draft.forbiddenActions) pushSentences(sentences, a);
  for (const u of draft.primaryUseCases) pushSentences(sentences, u);
  for (const v of draft.vocabulary) pushSentences(sentences, `${v.term} ${v.definition}`);
  for (const p of draft.antiPatterns ?? []) pushSentences(sentences, p);
  return sentences;
}

function pushSentences(acc: string[], text: string): void {
  for (const raw of text.split(/(?<=[.!?])\s+/)) {
    const t = raw.trim();
    if (t.length > 0) acc.push(t);
  }
}

function isSupported(sentence: string, corpus: Set<string>, minOverlap: number): boolean {
  const tokens = tokenize(sentence);
  if (tokens.length === 0) return true;
  let hits = 0;
  for (const t of tokens) {
    if (corpus.has(t)) hits += 1;
    if (hits >= minOverlap) return true;
  }
  // Short sentences (< minOverlap content tokens): require every token to be known.
  return tokens.length < minOverlap && tokens.every((t) => corpus.has(t));
}

const STOPWORDS = new Set([
  "a", "an", "and", "or", "but", "the", "of", "to", "in", "on", "at", "for",
  "with", "by", "as", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "their", "our", "we", "you",
  "they", "he", "she", "i", "my", "your", "his", "her", "them", "from",
  "not", "no", "do", "does", "did", "doing", "have", "has", "had", "about",
  "can", "could", "should", "would", "will", "may", "might", "must", "so",
  "if", "than", "then", "when", "while", "also", "any", "all", "each", "some",
  "just", "only", "how", "what", "why", "who", "whose",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}
