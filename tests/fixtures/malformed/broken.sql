-- Intentionally truncated CREATE TABLE for parse-failure testing.
-- /atw.schema must surface a line/column error and halt without an LLM call.

CREATE TABLE product (
  id           uuid PRIMARY KEY,
  handle       text UNIQUE NOT NULL,
  title        text NOT NULL,
  description  text,
  -- missing closing paren + semicolon on purpose
