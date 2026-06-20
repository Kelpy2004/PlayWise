# ── Stage 1: install production deps ──────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev && npx prisma generate

# ── Stage 2: production image ─────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app

RUN addgroup -S playwise && adduser -S playwise -G playwise

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

RUN mkdir -p data && chown -R playwise:playwise /app

USER playwise

ENV NODE_ENV=production
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "server.js"]
