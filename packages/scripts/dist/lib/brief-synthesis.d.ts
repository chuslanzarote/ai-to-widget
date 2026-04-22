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
export declare function verifyBriefAnchoring(draft: BriefArtifact, answers: BriefAnswers, options?: BriefAnchorOptions): BriefAnchorReport;
export interface BriefAnswers {
    businessScope: string;
    customers: string;
    allowedActions: string[];
    forbiddenActions: string[];
    tone: string;
    primaryUseCases: string[];
    vocabulary: {
        term: string;
        definition: string;
    }[];
    antiPatterns?: string[];
}
//# sourceMappingURL=brief-synthesis.d.ts.map