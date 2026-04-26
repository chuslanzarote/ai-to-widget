import type { Pool } from "pg";
import { RetrievalError } from "./errors.js";
import { scrubPii } from "../_shared/runtime-pii-scrub.js";

/**
 * pgvector retrieval for the runtime chat loop.
 * Contract: specs/003-runtime/contracts/chat-endpoint.md §4 step 7.
 */
export interface RetrievalHit {
  entity_id: string;
  entity_type: string;
  document: string;
  facts: Array<{ claim: string; source: string }>;
  categories: Record<string, string[]>;
  similarity: number;
  pii_redactions: number;
}

export interface RetrievalOptions {
  embedding: number[];
  threshold: number;
  topK: number;
  pool: Pool;
  timeoutMs?: number;
}

export async function runRetrieval(opts: RetrievalOptions): Promise<RetrievalHit[]> {
  const { embedding, threshold, topK, pool } = opts;
  const timeoutMs = opts.timeoutMs ?? 2000;
  const literal = pgvectorLiteral(embedding);
  const client = await pool.connect();
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new RetrievalError()), timeoutMs);
  });
  try {
    const q = client.query<{
      entity_id: string;
      entity_type: string;
      document: string;
      facts: unknown;
      categories: unknown;
      similarity: string;
    }>(
      `SELECT entity_id, entity_type, document, facts, categories,
              (1 - (embedding <=> $1::vector))::text AS similarity
         FROM atw_documents
        WHERE 1 - (embedding <=> $1::vector) > $2
        ORDER BY embedding <=> $1::vector
        LIMIT $3`,
      [literal, threshold, topK],
    );
    const res = await Promise.race([q, timeoutPromise]);
    const rows = res.rows.map((row) => {
      const scrubbedDoc = scrubPii(row.document);
      const facts = Array.isArray(row.facts)
        ? (row.facts as Array<{ claim: string; source: string }>)
            .map((f) => ({
              source: f.source,
              claimScrub: scrubPii(String(f.claim ?? "")),
            }))
            .map((x) => ({ source: x.source, claim: x.claimScrub.text, red: x.claimScrub.redactions }))
        : [];
      const totalRed =
        scrubbedDoc.redactions + facts.reduce((acc, f) => acc + f.red, 0);
      return {
        entity_id: row.entity_id,
        entity_type: row.entity_type,
        document: scrubbedDoc.text,
        facts: facts.map((f) => ({ claim: f.claim, source: f.source })),
        categories: (row.categories as Record<string, string[]>) ?? {},
        similarity: Number(row.similarity),
        pii_redactions: totalRed,
      };
    });
    return rows.filter((r) => r.document.length > 0);
  } catch (err) {
    if (err instanceof RetrievalError) throw err;
    throw new RetrievalError();
  } finally {
    if (timer) clearTimeout(timer);
    client.release();
  }
}

/**
 * pgvector expects a text literal of the form "[0.1,0.2,...]". Numeric
 * precision is preserved via JSON stringify.
 */
function pgvectorLiteral(vec: number[]): string {
  return "[" + vec.map((n) => String(n)).join(",") + "]";
}
