#!/bin/sh
# T061 / US4 — Medusa backend entrypoint.
# On first container boot: run migrations, seed once. Subsequent boots:
# skip the seeder if it has already run (idempotent per FR-034).

set -e

cd /app/medusa

echo "[medusa] running migrations..."
npx medusa db:migrate || echo "[medusa] migrations reported an issue; continuing"

# Seed only when the marker file is absent. The seeder itself is idempotent
# (truncates then reinserts), but avoiding unnecessary truncations shaves
# ~20 s off warm restarts.
SEED_MARKER=/app/medusa/.seed-complete
if [ ! -f "$SEED_MARKER" ]; then
  echo "[medusa] seeding from /app/seed..."
  node /app/seed/seed.mjs || { echo "[medusa] seed failed"; exit 1; }
  touch "$SEED_MARKER"
  echo "[medusa] seed complete"
else
  echo "[medusa] seed marker present; skipping"
fi

echo "[medusa] starting server on :9000..."
exec npx medusa start
