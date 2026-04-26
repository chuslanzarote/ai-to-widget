-- Feature 002 Migration 002 — atw_documents
-- Contract: data-model.md §2, contracts/enrichment.md §4
--
-- The indexable document row produced by the enrichment loop. One row per
-- (entity_type, entity_id). Embedding is a 384-dim vector populated by
-- Xenova/bge-small-multilingual-v1.5. source_hash binds the row to the
-- exact input + prompt + model that produced it (§4 of enrichment contract).

BEGIN;

CREATE TABLE IF NOT EXISTS atw_documents (
  id            BIGSERIAL PRIMARY KEY,
  entity_type   TEXT        NOT NULL,
  entity_id     TEXT        NOT NULL,
  document      TEXT        NOT NULL,
  facts         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  categories    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  embedding     vector(384),
  source_hash   TEXT        NOT NULL,
  opus_tokens   JSONB       NOT NULL DEFAULT '{"input":0,"output":0}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT atw_documents_entity_type_chk CHECK (length(entity_type) > 0),
  CONSTRAINT atw_documents_entity_id_chk   CHECK (length(entity_id) > 0),
  CONSTRAINT atw_documents_document_chk    CHECK (length(trim(document)) >= 40),
  CONSTRAINT atw_documents_source_hash_fmt CHECK (source_hash LIKE 'sha256:%')
);

CREATE UNIQUE INDEX IF NOT EXISTS atw_documents_entity_uidx
  ON atw_documents (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS atw_documents_source_hash_idx
  ON atw_documents (source_hash);

CREATE OR REPLACE FUNCTION atw_documents_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS atw_documents_touch_updated_at_trg ON atw_documents;
CREATE TRIGGER atw_documents_touch_updated_at_trg
BEFORE UPDATE ON atw_documents
FOR EACH ROW EXECUTE FUNCTION atw_documents_touch_updated_at();

COMMIT;
