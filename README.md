# KickStake

Create a football tournament sweepstake, share a link, and let the app run the
draw and the prizes for you. **Domain:** kickstake.app

See [`planning/KickStake — Build Spec v1.md`](./planning/KickStake%20—%20Build%20Spec%20v1.md)
for the full product spec, and [`planning/mockups/`](./planning/mockups) for the UI
direction (v1 "Matchday").

## Architecture

Monorepo powered by pnpm workspaces + Turborepo.

| Package | Stack | Port |
|---------|-------|------|
| `packages/web` | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui | 3800 |
| `packages/api` | NestJS 11, Drizzle ORM, Better Auth | 3801 |
| `packages/postgres` | Local Docker Postgres orchestration | 5434 |

**Infrastructure:** Render (PostgreSQL + Docker web services), defined in `render.yaml`.

## Local development

Prerequisites: Node 22+ (LTS), pnpm 10+, Docker.

```bash
# 1. Install dependencies
pnpm install

# 2. Set up API env
cp packages/api/.env.example packages/api/.env
cp packages/web/.env.example packages/web/.env

# 3. Start Postgres (Docker) and run migrations
pnpm postgres:dev

# 4. Seed the 2026 FIFA World Cup (48 teams, 12 groups)
pnpm db:seed

# 5. Start all services
pnpm dev
#   web → http://localhost:3800
#   api → http://localhost:3801  (Swagger at /api-docs)
```

Run services individually with `pnpm web:dev` / `pnpm api:dev`.

## Database

Drizzle ORM with PostgreSQL. Schema lives in `packages/api/src/db/schema/`.

```bash
pnpm db:generate   # generate a migration from schema changes
pnpm db:migrate    # apply migrations
pnpm db:seed       # (re)seed WC2026 tournament data
```

Money is stored as **integer minor units** (e.g. cents) throughout. KickStake is
**tracking-only** — it never processes payments.

## Tests

API integration tests spin up a throwaway `kickstake_test` database:

```bash
cd packages/api && pnpm test
```

## Deployment

Push to `test` or `main` to trigger Render deploys per `render.yaml`. Each
environment has its own Postgres, API, and web service.
