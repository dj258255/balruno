# SPDX-License-Identifier: AGPL-3.0-or-later
# Multi-stage Dockerfile for the Balruno collab (Hocuspocus) server.
# Stage 1: install all deps + tsc compile.
# Stage 2: minimal Alpine runtime with prod deps + dist/.
#
# Build context: packages/collab (mirrors the backend Dockerfile).

# ─── Build stage ──────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /workspace

# Pre-install deps so a code-only change benefits from layer cache.
COPY package.json ./
# package-lock.json is committed only after the first stable build — the
# COPY is intentionally permissive so initial builds without a lockfile
# still succeed.
COPY package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src
RUN npx tsc

# ─── Runtime stage ────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Production deps only — saves ~150 MB vs the build image.
COPY package.json ./
COPY package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund \
 && npm cache clean --force

COPY --from=build /workspace/dist ./dist

# Non-root (uid 1001 — same convention as the backend container).
RUN addgroup -g 1001 -S collab \
 && adduser -u 1001 -S collab -G collab \
 && chown -R collab:collab /app
USER collab

EXPOSE 1234

# A WebSocket server returns HTTP 426 Upgrade Required on a plain GET —
# we treat that as "alive". Any non-426 / non-200 response or a
# connection error means the process isn't serving.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD node -e "require('http').get('http://127.0.0.1:1234/', r => process.exit([200, 426].includes(r.statusCode) ? 0 : 1)).on('error', () => process.exit(1))" \
   || exit 1

CMD ["node", "dist/server.js"]
