# syntax=docker/dockerfile:1.6

# -------------------- Stage 1: builder ---------------------------------------
# Installs node deps and compiles TypeScript. The compiled `dist/` is then
# copied into the runtime stage — no build tools ship in the final image.
FROM node:20-bookworm-slim AS builder

WORKDIR /work

# Install only production deps for the backend workspace. We copy package
# manifests first so Docker can cache the dep layer independently of source
# changes. T095 / US8: `npm install` must run BEFORE `COPY src` so source
# edits don't invalidate the dep layer.
COPY package.json ./
COPY tsconfig.json ./

RUN npm install --omit=dev --ignore-scripts && npm install typescript --no-save

# Copy source last so changes don't invalidate the dep layer.
COPY src ./src

RUN npx tsc

# Pre-warm the embedding model cache so the runtime image does not need to
# download weights on first call. This is the FR-077 requirement. If the
# @xenova/transformers dep is not yet installed in this workspace (backend
# is a thin compile-only workspace), the cache-warm is a no-op.
RUN node -e "try { require('@xenova/transformers') } catch { process.exit(0) }" \
    && node -e "require('@xenova/transformers').pipeline('feature-extraction', 'Xenova/bge-small-multilingual-v1.5')" \
    || true

# -------------------- Stage 2: runtime ---------------------------------------
# Distroless-style minimal runtime. No secrets, no build tooling.
FROM gcr.io/distroless/nodejs20-debian12 AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /work/package.json /app/package.json
COPY --from=builder /work/node_modules /app/node_modules
COPY --from=builder /work/dist /app/dist

USER nonroot:nonroot

CMD ["/app/dist/index.js"]
