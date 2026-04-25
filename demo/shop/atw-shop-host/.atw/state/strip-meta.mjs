import { readFileSync, writeFileSync } from "node:fs";
const src = readFileSync(".atw/inputs/atw-coffee-shop-products.sql", "utf8");
const cleaned = src
  .split(/\r?\n/)
  .filter((l) => !/^\\(restrict|unrestrict)\b/.test(l))
  .filter((l) => !/^SET\s+transaction_timeout\b/i.test(l))
  .filter((l) => !/^ALTER\s+TABLE\s+.*OWNER\s+TO\b/i.test(l))
  .join("\n");
writeFileSync(".atw/inputs/atw-coffee-shop-products.cleaned.sql", cleaned);
console.log("cleaned bytes:", cleaned.length);
