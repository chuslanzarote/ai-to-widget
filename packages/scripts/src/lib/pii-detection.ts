import type { ParsedSQLSchema, ParsedSQLTable } from "./types.js";

export type PIIClass =
  | "email"
  | "phone"
  | "name"
  | "address"
  | "payment"
  | "gov-id"
  | "free-text-bio";

export interface ColumnPIIFlag {
  schema: string;
  table: string;
  column: string;
  piiClass: PIIClass;
  evidence: string;
}

export interface TablePIIFlag {
  schema: string;
  table: string;
  reason: string;
  columns: string[];
}

export interface PIIReport {
  columns: ColumnPIIFlag[];
  tables: TablePIIFlag[];
}

const COLUMN_HEURISTICS: { pattern: RegExp; piiClass: PIIClass; evidence: string }[] = [
  { pattern: /(^|_)e_?mail(_|$)|^email$/i, piiClass: "email", evidence: "column name matches email pattern" },
  { pattern: /(^|_)phone(_|$)|mobile|tel_number/i, piiClass: "phone", evidence: "column name matches phone pattern" },
  { pattern: /first_name|last_name|full_name|^name$|middle_name/i, piiClass: "name", evidence: "column name is a personal name field" },
  { pattern: /address(_|$)|street|city|postal_code|province|zip_code/i, piiClass: "address", evidence: "column name matches postal address field" },
  { pattern: /(^|_)card(_|$)|card_number|card_last_four|card_brand|cvv|iban|bic|swift/i, piiClass: "payment", evidence: "column name matches payment-instrument field" },
  { pattern: /ssn|national_id|passport|tax_id|gov_id|license_number/i, piiClass: "gov-id", evidence: "column name matches government identifier" },
  { pattern: /bio|biography|about_me|profile_text/i, piiClass: "free-text-bio", evidence: "column name is a free-text biographical field" },
];

const SAMPLE_VALUE_HEURISTICS: { detector: (v: string) => boolean; piiClass: PIIClass; evidence: string }[] = [
  {
    detector: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    piiClass: "email",
    evidence: "sample values look like email addresses",
  },
  {
    detector: (v) => /^\+?\d[\d\s\-().]{6,}\d$/.test(v),
    piiClass: "phone",
    evidence: "sample values look like phone numbers",
  },
  {
    detector: (v) => /^\d{3}-\d{2}-\d{4}$/.test(v),
    piiClass: "gov-id",
    evidence: "sample values match US SSN format",
  },
];

// Table-level defaults (FR-022): whole tables excluded by default.
const TABLE_LEVEL_DEFAULTS = [
  { pattern: /^customer$|_customer$|^customers$/i, reason: "customer records default to PII-excluded" },
  { pattern: /^customer_address$|address(?!_type)/i, reason: "addresses default to PII-excluded" },
  { pattern: /^payment$|payments|^refund$|^refunds$/i, reason: "payment data defaults to PII-excluded" },
  { pattern: /^admin_user$|^user$|^users$|^account$|^accounts$/i, reason: "account/user records default to PII-excluded" },
  { pattern: /session|^token$|^tokens$/i, reason: "session/token tables default to excluded" },
];

export function detectPII(
  schema: ParsedSQLSchema,
  sampleRows: Record<string, ReadonlyArray<Record<string, unknown>>> = {},
): PIIReport {
  const columns: ColumnPIIFlag[] = [];
  const tables: TablePIIFlag[] = [];

  for (const s of schema.schemas) {
    for (const t of s.tables) {
      for (const col of t.columns) {
        const byName = COLUMN_HEURISTICS.find((h) => h.pattern.test(col.name));
        if (byName) {
          columns.push({
            schema: s.name,
            table: t.name,
            column: col.name,
            piiClass: byName.piiClass,
            evidence: byName.evidence,
          });
          continue;
        }
        const key = `${s.name}.${t.name}`;
        const rows = sampleRows[key] ?? sampleRows[t.name] ?? [];
        for (const row of rows.slice(0, 50)) {
          const raw = row[col.name];
          if (typeof raw !== "string") continue;
          const byValue = SAMPLE_VALUE_HEURISTICS.find((h) => h.detector(raw));
          if (byValue) {
            columns.push({
              schema: s.name,
              table: t.name,
              column: col.name,
              piiClass: byValue.piiClass,
              evidence: byValue.evidence,
            });
            break;
          }
        }
      }

      const tableLevelHit = TABLE_LEVEL_DEFAULTS.find((h) => h.pattern.test(t.name));
      if (tableLevelHit) {
        tables.push({
          schema: s.name,
          table: t.name,
          reason: tableLevelHit.reason,
          columns: t.columns.map((c) => c.name),
        });
      }
    }
  }

  return { columns, tables };
}

export function piiColumnsFor(report: PIIReport, table: ParsedSQLTable): string[] {
  return report.columns
    .filter((c) => c.table === table.name)
    .map((c) => c.column);
}
