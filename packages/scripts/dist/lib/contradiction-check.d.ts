export interface ContradictionAnswers {
    allowedActions: string[];
    forbiddenActions: string[];
    primaryUseCases: string[];
    tone: string;
}
export interface Contradiction {
    kind: "allowed-vs-forbidden" | "use-case-vs-forbidden" | "tone-vs-action";
    left: string;
    right: string;
    overlap: string[];
}
export interface ContradictionReport {
    contradictions: Contradiction[];
    /** A Builder-facing prompt asking for disambiguation; empty when none. */
    disambiguationPrompt: string;
}
/**
 * Detects self-conflicting Builder answers per FR-014.
 *
 * Heuristic: shared action verbs + shared domain nouns between an
 * "allowed" and "forbidden" statement (or a "forbidden" statement and a
 * use case) are flagged. We don't try to be clever — we surface the
 * potential conflict verbatim and let the Builder rule on it.
 */
export declare function detectContradictions(answers: ContradictionAnswers): ContradictionReport;
//# sourceMappingURL=contradiction-check.d.ts.map