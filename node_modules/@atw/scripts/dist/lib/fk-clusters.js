/**
 * FK-graph clustering via union-find (FR-024).
 *
 * Every edge is a foreign key. Isolated tables form singleton clusters.
 * Used by /atw.schema to decide how to chunk LLM classification requests
 * when the schema is large enough (>100 tables or >500 columns).
 */
export function clusterTables(schema) {
    const tables = [];
    for (const s of schema.schemas) {
        for (const t of s.tables) {
            tables.push({ name: `${s.name}.${t.name}`, table: t });
        }
    }
    const parent = new Map();
    const rank = new Map();
    for (const t of tables) {
        parent.set(t.name, t.name);
        rank.set(t.name, 0);
    }
    const find = (x) => {
        let cur = x;
        while (parent.get(cur) !== cur) {
            parent.set(cur, parent.get(parent.get(cur)));
            cur = parent.get(cur);
        }
        return cur;
    };
    const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra === rb)
            return;
        const rnkA = rank.get(ra);
        const rnkB = rank.get(rb);
        if (rnkA < rnkB)
            parent.set(ra, rb);
        else if (rnkA > rnkB)
            parent.set(rb, ra);
        else {
            parent.set(rb, ra);
            rank.set(ra, rnkA + 1);
        }
    };
    for (const t of tables) {
        for (const fk of t.table.foreignKeys) {
            const target = `${fk.referenceSchema}.${fk.referenceTable}`;
            if (parent.has(target)) {
                union(t.name, target);
            }
        }
    }
    const groups = new Map();
    for (const t of tables) {
        const root = find(t.name);
        const arr = groups.get(root) ?? [];
        arr.push(t.name);
        groups.set(root, arr);
    }
    const clusters = [];
    let id = 0;
    for (const [, members] of groups) {
        clusters.push({ id: id++, tables: members.sort() });
    }
    // Stable order: largest cluster first, then lex by first member.
    clusters.sort((a, b) => b.tables.length - a.tables.length || a.tables[0].localeCompare(b.tables[0]));
    return clusters;
}
//# sourceMappingURL=fk-clusters.js.map