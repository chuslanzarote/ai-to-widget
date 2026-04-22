/**
 * Connection-string / credential detector (FR-018 + SC-010).
 *
 * /atw.schema must *refuse* raw DB connection strings or paired
 * `host=...` / `password=...` credentials. This is a guard applied at
 * the script boundary so credentials are rejected *before* any parsing
 * happens — if we parsed a connection string we'd be tacitly accepting
 * that the Builder might have pasted one.
 */
const CONN_STRING_SCHEMES = [
    /\bpostgres(?:ql)?:\/\/[^\s]+/i,
    /\bpg:\/\/[^\s]+/i,
    /\bmysql:\/\/[^\s]+/i,
    /\bmongodb(?:\+srv)?:\/\/[^\s]+/i,
    /\bredis(?:s)?:\/\/[^\s]+/i,
];
const KEY_VALUE_PAIR = /(?:^|\s)(host|password|user|dbname|port|sslmode)\s*=\s*[^\s]+/gi;
export function detectCredentials(input) {
    const matches = [];
    for (const rx of CONN_STRING_SCHEMES) {
        const m = input.match(rx);
        if (m)
            matches.push({ kind: "scheme", sample: redact(m[0]) });
    }
    const kvHits = [];
    for (const m of input.matchAll(KEY_VALUE_PAIR)) {
        kvHits.push(m[0].trim());
    }
    const distinctKeys = new Set(kvHits.map((hit) => hit.split("=")[0].trim().toLowerCase()));
    // A single `dbname=foo` by itself is fine in a dump comment. Two or more
    // of these keys co-occurring is the libpq pattern and we refuse it.
    if (distinctKeys.size >= 2) {
        matches.push({ kind: "kv-pair", sample: redact(kvHits.slice(0, 3).join(" ")) });
    }
    return { found: matches.length > 0, matches };
}
export const REFUSAL_MESSAGE = "I don't accept database connection strings or credentials. Please export " +
    "a schema-only dump with `pg_dump --schema-only` and share the file path or " +
    "paste its contents. /atw.schema never talks to a database directly.";
function redact(sample) {
    // Replace the value after `=` or after `://` with **** so logs/errors
    // never echo credentials back to the Builder.
    return sample
        .replace(/(:\/\/[^@/\s]+@)/g, "://****@")
        .replace(/(password\s*=\s*)\S+/gi, "$1****")
        .replace(/(:\/\/)([^:\s]+:)[^@\s]+/g, "$1$2****");
}
//# sourceMappingURL=credential-guard.js.map