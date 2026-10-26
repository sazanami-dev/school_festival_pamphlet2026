# syntax=docker/dockerfile:1

# ターゲット:
#   dev      … 開発用（ソースはボリュームマウント、next dev でホットリロード）
#   migrator … 本番用マイグレーション実行（drizzle-kit migrate を1回だけ実行）
#   runner   … 本番用 Next.js（standalone 出力のみを含む軽量イメージ）

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- 依存関係 ----------
FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---------- 開発用 ----------
FROM deps AS dev
ENV NODE_ENV=development
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# ---------- ビルド ----------
FROM deps AS builder
COPY . .
ENV NODE_ENV=production
RUN npm run build

# ---------- 本番マイグレーション ----------
FROM deps AS migrator
COPY drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/db/schema.ts ./src/db/schema.ts
# マイグレーションが1件も無い状態では drizzle-kit migrate が失敗するためスキップする
CMD ["sh", "-c", "if [ -f drizzle/meta/_journal.json ]; then npx drizzle-kit migrate; else echo 'no migrations, skipped'; fi"]

# ---------- 本番用 ----------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S -g 1001 nodejs && adduser -S -u 1001 -G nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
