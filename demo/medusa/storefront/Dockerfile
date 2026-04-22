# syntax=docker/dockerfile:1.6
#
# T062 / US4 — Aurelia Next.js storefront with the embedded widget.
# Contract: specs/003-runtime/contracts/compose.md §1.4, §3 (Option A).
#
# The image copies the widget bundle from the repo's dist/ (produced by
# Feature 002 /atw.build) at build time. Re-run `docker compose build
# medusa_storefront` after re-building the widget to pick up changes.

FROM node:20-bookworm-slim AS builder

ARG STOREFRONT_COMMIT_SHA=v2.0.0
WORKDIR /work

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch "${STOREFRONT_COMMIT_SHA}" https://github.com/medusajs/nextjs-starter-medusa.git /work/storefront \
    || git clone https://github.com/medusajs/nextjs-starter-medusa.git /work/storefront \
       && (cd /work/storefront && git checkout "${STOREFRONT_COMMIT_SHA}")

WORKDIR /work/storefront

# Aurelia branding overlay — our layout.tsx with the widget <script>.
# Any file under storefront-overlay/ replaces its counterpart in the
# checked-out starter.
COPY app/ /work/storefront-overlay/app/
RUN if [ -d /work/storefront-overlay ]; then cp -R /work/storefront-overlay/* /work/storefront/; fi

# Drop the compiled widget into public/ so it's served at /widget.js and
# /widget.css. The compose build context copies it in before `docker build`.
COPY public/widget.js /work/storefront/public/widget.js
COPY public/widget.css /work/storefront/public/widget.css

RUN corepack enable \
    && yarn install --production=false \
    && yarn build

# -------------------- Stage 2: runtime ---------------------------------------
FROM node:20-bookworm-slim AS runtime

WORKDIR /app
COPY --from=builder /work/storefront /app/storefront

ENV NODE_ENV=production
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "cd /app/storefront && yarn start -p 8000"]
