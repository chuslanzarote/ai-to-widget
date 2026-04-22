# syntax=docker/dockerfile:1.6
#
# Aurelia demo — Medusa v2 backend image.
# Scaffolded from the official medusajs/medusa-starter-default structure.
# Reproducibility comes from pinned package versions in app/package.json.

FROM node:20-bookworm-slim

WORKDIR /server

# Build deps (some native modules need python + build tools).
RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install deps from the pinned package.json.
COPY app/package.json ./package.json
RUN npm install --no-audit --no-fund

# Copy the rest of the project and build.
COPY app/ ./
RUN npx medusa build

# Seed + startup orchestration.
COPY start.sh /server/start.sh
RUN chmod +x /server/start.sh

ENV NODE_ENV=production
EXPOSE 9000

ENTRYPOINT ["/server/start.sh"]
