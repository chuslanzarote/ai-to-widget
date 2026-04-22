import { describe, it, expect } from "vitest";
import { detectCredentials, REFUSAL_MESSAGE } from "../src/lib/credential-guard.js";

describe("credential-guard (T063, FR-018 + SC-010)", () => {
  it("flags postgres:// connection URIs", () => {
    const r = detectCredentials("postgres://alice:hunter2@db.example.com:5432/app");
    expect(r.found).toBe(true);
    expect(r.matches[0].kind).toBe("scheme");
    // never echo the real password back
    expect(r.matches[0].sample).not.toContain("hunter2");
  });

  it("flags mysql:// and mongodb://", () => {
    expect(detectCredentials("mysql://u:p@host/db").found).toBe(true);
    expect(detectCredentials("mongodb+srv://u:p@cluster.mongodb.net/app").found).toBe(true);
  });

  it("flags libpq-style key=value pairs when >=2 keys co-occur", () => {
    const r = detectCredentials("host=db.example.com password=secret dbname=app");
    expect(r.found).toBe(true);
    expect(r.matches.some((m) => m.kind === "kv-pair")).toBe(true);
    expect(r.matches[0].sample).not.toContain("secret");
  });

  it("does NOT flag a single stray `dbname=` comment", () => {
    const r = detectCredentials("-- created from dbname=app\nCREATE TABLE x (id int);");
    expect(r.found).toBe(false);
  });

  it("does NOT flag a benign CREATE TABLE dump", () => {
    const r = detectCredentials("CREATE TABLE product (id uuid PRIMARY KEY, title text);");
    expect(r.found).toBe(false);
  });

  it("REFUSAL_MESSAGE instructs the Builder to use pg_dump", () => {
    expect(REFUSAL_MESSAGE).toMatch(/pg_dump/);
    expect(REFUSAL_MESSAGE).toMatch(/--schema-only/);
  });
});
