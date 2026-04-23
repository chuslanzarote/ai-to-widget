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

RUN npm install --omit=dev --ignore-scripts \
    && npm rebuild sharp \
    && npm install typescript --no-save

# Copy source last so changes don't invalidate the dep layer.
COPY src ./src

RUN npx tsc

# Pre-warm the embedding model cache so the runtime image does not need to
# download weights on first call. This is the FR-077 requirement. The
# cache dir is /work/node_modules/@xenova/transformers/.cache/ and it
# propagates to the runtime stage via the node_modules COPY below.
RUN node -e "(async()=>{const m=await import('@xenova/transformers'); await m.pipeline('feature-extraction', 'Xenova/bge-small-en-v1.5'); console.log('[prewarm] bge-small-en-v1.5 cached')})()"

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
