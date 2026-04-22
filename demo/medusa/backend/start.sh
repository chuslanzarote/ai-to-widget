#!/bin/sh
# Medusa v2 backend entrypoint.
#
# Boot sequence:
#   1. run migrations (idempotent).
#   2. if not yet seeded: run seed + export publishable key, write marker.
#   3. start the server on :9000.
#
# Re-run seeding by removing /runtime/.seed-complete.

set -e

cd /server

echo "[medusa] running migrations..."
npx medusa db:migrate

SEED_MARKER=/runtime/.seed-complete
mkdir -p /runtime

if [ ! -f "$SEED_MARKER" ]; then
  echo "[medusa] seeding demo data..."
  npm run seed

  echo "[medusa] exporting publishable key to /runtime/publishable-key.txt..."
  npm run export-pk

  touch "$SEED_MARKER"
  echo "[medusa] seed complete."
else
  echo "[medusa] seed marker present; skipping seed step."
fi

echo "[medusa] starting server on :9000..."
exec npm run start
