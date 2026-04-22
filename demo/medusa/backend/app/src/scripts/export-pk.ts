import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Exports the seeded publishable API key token to a file that scripts/make.ps1
 * (or the Makefile) reads to pass as a build arg to the storefront image.
 * Default target path is /runtime/publishable-key.txt — mounted via compose.
 */
export default async function exportPublishableKey({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const { data } = await query.graph({
    entity: "api_key",
    fields: ["id", "token", "type"],
    filters: { type: "publishable" },
  });

  const key = data?.[0];
  if (!key?.token) {
    throw new Error(
      "[export-pk] no publishable key found — seed must run first."
    );
  }

  const outPath = process.env.PK_EXPORT_PATH || "/runtime/publishable-key.txt";
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, key.token, "utf8");
  logger.info(`[export-pk] wrote publishable key to ${outPath}`);
}
