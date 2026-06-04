# NestJS API (KickStake) – build from repo root: docker build -f packages/api/Dockerfile .
# Render: rootDir unset (repo root), dockerfilePath: packages/api/Dockerfile, dockerContext: .

FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json ./packages/api/
COPY packages/postgres/package.json ./packages/postgres/

# Install all deps (including dev for nest build).
# Use non-frozen here to avoid CI lockfile strictness during image build.
ENV NODE_ENV=development
RUN corepack enable pnpm && pnpm install --no-frozen-lockfile

COPY packages/api ./packages/api

RUN pnpm --filter @kickstake/api run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

COPY --from=builder /app/packages/api/dist ./dist
COPY --from=builder /app/packages/api/package.json ./
COPY --from=builder /app/packages/api/drizzle.config.migrate.cjs ./
COPY --from=builder /app/packages/api/drizzle ./drizzle

# Strip devDependencies so npm install never sees workspace:* (runner is not a pnpm workspace).
RUN node -e "const p=require('./package.json'); delete p.devDependencies; require('fs').writeFileSync('package.json', JSON.stringify(p, null, 2));"

RUN npm install --omit=dev --legacy-peer-deps

USER nestjs

EXPOSE 10000

# Migrate then start. Log clearly so Render logs show where it failed (migrate vs app).
CMD ["sh", "-c", "echo 'Checking DATABASE_URL...' && if [ -z \"$DATABASE_URL\" ]; then echo 'Fatal: DATABASE_URL is not set. Add it in Render service Environment.'; exit 1; fi && echo 'Running migrations...' && ./node_modules/.bin/drizzle-kit migrate --config=drizzle.config.migrate.cjs || { echo 'Migration failed (see above).'; exit 1; } && echo 'Starting API...' && exec node dist/main.js"]
