-- Feature 002 Migration 003 — HNSW vector index for retrieval
-- Contract: data-model.md, plan.md Technical Context
--
-- pgvector's HNSW index on atw_documents.embedding using cosine distance.
-- Opus 4.7 retrieval queries in Feature 003 use `ORDER BY embedding <=> $1`
-- which needs this index to be performant.

BEGIN;

CREATE INDEX IF NOT EXISTS atw_documents_embedding_hnsw_idx
  ON atw_documents
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

COMMIT;
