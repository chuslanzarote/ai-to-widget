#!/usr/bin/env node
/**
 * T070 / US4 — Idempotent Medusa v2 seeder.
 * Reads the JSON fixtures in this directory and inserts them into the
 * Medusa backend via its admin API. Source:
 * specs/003-runtime/research §11 + contracts/compose.md §1.3.
 *
 * Idempotent: truncates relevant tables first, then reinserts. Running
 * this twice produces the same observable database state.
 *
 * Invoked by the Medusa container's entrypoint.sh on first boot; can
 * also be re-run manually via `make seed`.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadJson(name) {
  return JSON.parse(readFileSync(join(__dirname, name), "utf8"));
}

const products = loadJson("products.json");
const categories = loadJson("categories.json");
const collections = loadJson("collections.json");
const regions = loadJson("regions.json");
const customers = loadJson("customers.json");
const orders = loadJson("orders.json");

async function run() {
  const { Client } = await import("pg");
  const dsn = process.env.DATABASE_URL;
  if (!dsn) {
    process.stderr.write(
      "[seed] DATABASE_URL is not set — cannot connect.\n",
    );
    process.exit(2);
  }
  const client = new Client({ connectionString: dsn });
  await client.connect();
  try {
    await client.query("BEGIN");
    // Truncate in dependency order. CASCADE handles the transitive deletes.
    const tables = [
      "order_line_item",
      "order",
      "cart_line_item",
      "cart",
      "customer_address",
      "customer",
      "product_category_product",
      "product_collection_product",
      "product_variant",
      "product",
      "product_category",
      "product_collection",
      "region",
    ];
    for (const t of tables) {
      await client.query(`TRUNCATE TABLE IF EXISTS "${t}" CASCADE`).catch(() => void 0);
    }

    // Regions
    for (const r of regions) {
      await client.query(
        `INSERT INTO "region" (id, name, currency_code, tax_rate) VALUES ($1, $2, $3, $4)`,
        [r.id, r.name, r.currency_code, r.tax_rate],
      );
    }
    console.log(`[seed] ${regions.length} regions`);

    // Categories (insert parents first — our JSON is already ordered that way).
    for (const c of categories) {
      await client.query(
        `INSERT INTO "product_category" (id, handle, name, parent_id) VALUES ($1, $2, $3, $4)`,
        [c.id, c.handle, c.name, c.parent_id],
      );
    }
    console.log(`[seed] ${categories.length} categories`);

    // Collections
    for (const col of collections) {
      await client.query(
        `INSERT INTO "product_collection" (id, handle, title, description) VALUES ($1, $2, $3, $4)`,
        [col.id, col.handle, col.title, col.description],
      );
    }
    console.log(`[seed] ${collections.length} collections`);

    // Products + variants + category links + collection links
    for (const p of products) {
      await client.query(
        `INSERT INTO "product" (id, handle, title, description, status, origin_country, material)
         VALUES ($1, $2, $3, $4, 'published', $5, $6)`,
        [p.id, p.handle, p.title, p.description, p.origin_country ?? null, p.material ?? null],
      );
      for (const v of p.variants) {
        await client.query(
          `INSERT INTO "product_variant" (id, product_id, sku, title, inventory_quantity)
           VALUES ($1, $2, $3, $4, $5)`,
          [`var_${p.id}_${v.handle}`, p.id, v.sku, v.title, v.inventory_quantity],
        );
      }
      for (const catId of p.category_ids ?? []) {
        await client
          .query(
            `INSERT INTO "product_category_product" (product_id, category_id)
             VALUES ($1, $2)`,
            [p.id, catId],
          )
          .catch(() => void 0); // tolerate missing category
      }
      for (const colId of p.collection_ids ?? []) {
        await client
          .query(
            `INSERT INTO "product_collection_product" (product_id, collection_id)
             VALUES ($1, $2)`,
            [p.id, colId],
          )
          .catch(() => void 0);
      }
    }
    console.log(`[seed] ${products.length} products`);

    // Customers (demo fixtures — synthetic)
    for (const c of customers) {
      await client.query(
        `INSERT INTO "customer" (id, email, first_name, last_name, phone, has_account)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [c.id, c.email, c.first_name, c.last_name, c.phone, c.has_account],
      );
    }
    console.log(`[seed] ${customers.length} customers`);

    // Orders
    for (const o of orders) {
      await client.query(
        `INSERT INTO "order" (id, display_id, customer_id, region_id, currency_code, total, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [o.id, o.display_id, o.customer_id, o.region_id, o.currency_code, o.total, o.status, o.created_at],
      );
      for (let i = 0; i < o.items.length; i++) {
        const li = o.items[i];
        await client.query(
          `INSERT INTO "order_line_item" (id, order_id, variant_id, title, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `oli_${o.id}_${i}`,
            o.id,
            `var_${li.product_id}_${li.variant_handle}`,
            `${li.product_id} / ${li.variant_handle}`,
            li.quantity,
            li.unit_price,
          ],
        );
      }
    }
    console.log(`[seed] ${orders.length} orders`);

    await client.query("COMMIT");
    console.log("[seed] done");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[seed] failed:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

run();
