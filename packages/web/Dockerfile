# Next.js Frontend (KickStake) – build from repo root: docker build -f packages/web/Dockerfile .
# Render: rootDir unset (repo root), dockerfilePath: packages/web/Dockerfile, dockerContext: .
# Based on: https://github.com/vercel/next.js/tree/canary/examples/with-docker

FROM node:22-alpine AS dependencies

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/web/package.json ./packages/web/
COPY packages/api/package.json ./packages/api/
COPY packages/postgres/package.json ./packages/postgres/

RUN corepack enable pnpm && pnpm install --frozen-lockfile

FROM node:22-alpine AS builder

WORKDIR /app

COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=dependencies /app/packages/web/node_modules ./packages/web/node_modules
COPY packages/web ./packages/web
COPY package.json pnpm-workspace.yaml ./

# NEXT_PUBLIC_ vars must be set at build time for inlining.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN cd packages/web && npx next build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copy public assets
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/public ./packages/web/public

# Set correct permissions for prerender cache
RUN mkdir -p packages/web/.next && chown nextjs:nodejs packages/web/.next

# Copy standalone output and static assets
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/packages/web/.next/static ./packages/web/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "packages/web/server.js"]
