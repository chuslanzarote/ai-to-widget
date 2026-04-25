-- Feature 002 Migration 001 — Bootstrap schema
-- Contract: data-model.md, contracts/scripts.md §2
--
-- Installs the pgvector extension, a namespace schema for Builder data
-- ("client_ref") where the filtered SQL dump will be imported, and the
-- migration ledger itself.
--
-- Idempotency: uses IF NOT EXISTS where possible so applying this file
-- against an already-initialized database is a no-op. The migration
-- ledger in `atw_migrations` guarantees each file is applied exactly once.

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS client_ref;
COMMENT ON SCHEMA client_ref IS 'PII-filtered mirror of the Builder''s business data; rows loaded by atw-import-dump.';

CREATE TABLE IF NOT EXISTS atw_migrations (
  id           SERIAL PRIMARY KEY,
  filename     TEXT NOT NULL UNIQUE,
  sha256       TEXT NOT NULL,
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE atw_migrations IS 'Migration ledger: one row per applied file. sha256 lets the runner detect post-apply edits.';

COMMIT;
