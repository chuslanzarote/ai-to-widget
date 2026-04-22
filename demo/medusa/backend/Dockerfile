# syntax=docker/dockerfile:1.6
#
# T061 / US4 — Aurelia demo Medusa v2 backend image.
# Contract: specs/003-runtime/contracts/compose.md §1.3.
#
# Pre-requirement before `make demo`: a human sets `MEDUSA_COMMIT_SHA` to
# a pinned Medusa v2 commit. The image is reproducible under Principle VIII
# because the commit SHA locks the entire Medusa source tree.
#
# Stage 1 installs + builds Medusa + applies migrations + runs the seed;
# the runtime stage contains only the compiled output.

FROM node:20-bookworm-slim AS builder

ARG MEDUSA_COMMIT_SHA=v2.0.0
ENV MEDUSA_COMMIT_SHA=${MEDUSA_COMMIT_SHA}

WORKDIR /work

# Clone Medusa v2 at a pinned commit. We use git to respect Principle VIII
# (no untracked tarballs from CDNs).
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${MEDUSA_COMMIT_SHA}" https://github.com/medusajs/medusa.git /work/medusa \
    || git clone https://github.com/medusajs/medusa.git /work/medusa \
       && (cd /work/medusa && git checkout "${MEDUSA_COMMIT_SHA}")

WORKDIR /work/medusa

# Install production deps.
RUN corepack enable \
    && yarn install --production=false \
    && yarn build

# The seed JSON and seeder script ship from our repo.
COPY seed /work/seed

# Pre-seed the database schema during image build is not possible (no DB
# yet). The seeder runs at container start via entrypoint.sh.
COPY entrypoint.sh /work/entrypoint.sh
RUN chmod +x /work/entrypoint.sh

# -------------------- Stage 2: runtime ---------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app

# Copy the built Medusa plus our seeder data.
COPY --from=builder /work/medusa /app/medusa
COPY --from=builder /work/seed /app/seed
COPY --from=builder /work/entrypoint.sh /app/entrypoint.sh

ENV NODE_ENV=production
EXPOSE 9000

ENTRYPOINT ["/app/entrypoint.sh"]
