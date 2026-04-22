/**
 * Detects self-conflicting Builder answers per FR-014.
 *
 * Heuristic: shared action verbs + shared domain nouns between an
 * "allowed" and "forbidden" statement (or a "forbidden" statement and a
 * use case) are flagged. We don't try to be clever — we surface the
 * potential conflict verbatim and let the Builder rule on it.
 */
export function detectContradictions(answers) {
    const contradictions = [];
    for (const allowed of answers.allowedActions) {
        for (const forbidden of answers.forbiddenActions) {
            const overlap = significantOverlap(allowed, forbidden);
            if (overlap.length >= 2 && sharesActionVerb(allowed, forbidden)) {
                contradictions.push({
                    kind: "allowed-vs-forbidden",
                    left: allowed,
                    right: forbidden,
                    overlap,
                });
            }
        }
    }
    for (const useCase of answers.primaryUseCases) {
        for (const forbidden of answers.forbiddenActions) {
            const overlap = significantOverlap(useCase, forbidden);
            if (overlap.length >= 2 && sharesActionVerb(useCase, forbidden)) {
                contradictions.push({
                    kind: "use-case-vs-forbidden",
                    left: useCase,
                    right: forbidden,
                    overlap,
                });
            }
        }
    }
    const toneWords = tokens(answers.tone);
    if (toneWords.includes("terse") || toneWords.includes("concise")) {
        for (const allowed of answers.allowedActions) {
            if (tokens(allowed).includes("explain") || tokens(allowed).includes("elaborate")) {
                contradictions.push({
                    kind: "tone-vs-action",
                    left: answers.tone,
                    right: allowed,
                    overlap: ["explain"],
                });
            }
        }
    }
    return {
        contradictions,
        disambiguationPrompt: contradictions.length > 0 ? buildPrompt(contradictions) : "",
    };
}
const ACTION_VERBS = new Set([
    "discuss", "offer", "share", "promise", "process", "collect",
    "answer", "recommend", "negotiate", "quote", "estimate", "refund",
    "cancel", "check", "explain", "compare", "track",
]);
function sharesActionVerb(a, b) {
    const verbsA = tokens(a).filter((t) => ACTION_VERBS.has(t));
    const verbsB = tokens(b).filter((t) => ACTION_VERBS.has(t));
    return verbsA.some((v) => verbsB.includes(v));
}
function significantOverlap(a, b) {
    const setB = new Set(tokens(b));
    const out = new Set();
    for (const t of tokens(a)) {
        if (setB.has(t))
            out.add(t);
    }
    return [...out];
}
const STOPWORDS = new Set([
    "a", "an", "and", "or", "the", "of", "to", "in", "on", "at", "for",
    "with", "by", "as", "is", "are", "was", "were", "be", "been", "this",
    "that", "it", "its", "their", "our", "we", "you", "they", "from",
    "not", "no", "any", "all", "how", "what", "why", "when",
]);
function tokens(text) {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(/\s+/)
        .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}
function buildPrompt(contradictions) {
    const lines = contradictions.map((c, i) => {
        return `  ${i + 1}. ${describeKind(c.kind)}:\n     - ${c.left}\n     - ${c.right}`;
    });
    return [
        "Possible contradiction(s) between your answers:",
        ...lines,
        "",
        "Which statement should take precedence? You can also edit either side before continuing.",
    ].join("\n");
}
function describeKind(kind) {
    switch (kind) {
        case "allowed-vs-forbidden":
            return "An allowed action appears to overlap with a forbidden one";
        case "use-case-vs-forbidden":
            return "A use case appears to require a forbidden action";
        case "tone-vs-action":
            return "The tone appears to conflict with an allowed action";
    }
}
//# sourceMappingURL=contradiction-check.js.map