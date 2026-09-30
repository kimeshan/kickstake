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
| `packages/postgres` | Local Docker Postgres orchestration | 5437 |

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

Playwright E2E (needs Postgres up + seeded; boots both servers if absent):

```bash
pnpm --filter @kickstake/web test:e2e
```

## KickStake Challenge (activity challenge)

A four-week group activity challenge that lives in the same web app, API and
database: people join from one invitation link, sign in with an emailed code,
and enter **one minute total per Monday–Sunday week**. Levels, medals, streaks
and group results are computed server-side (`packages/api/src/challenges/`).
Production host: **challenge.kickstake.app** (same Render web service —
`/` on that host is rewritten to `/challenges`).

| Route | Purpose |
|-------|---------|
| `/challenges` | Challenge home (your challenges, or invitation instructions) |
| `/challenges/join/:token` | Public invitation → sign in → display name → join |
| `/challenges/:id` | My progress + Update minutes |
| `/challenges/:id/group` | Member-only group results |
| `/challenges/:id/rules` | Level ladder, dates, counting rules |
| `/challenges/:id/manage` | Organiser tools (owner only) |

API routes are `/challenges/*` on Nest (the browser calls `/api/challenges/*`
through the web rewrite) — see Swagger at `/api-docs`.

**Environment variables**

| Variable | Where | Purpose |
|----------|-------|---------|
| `CHALLENGE_APP_URL` | API | Base for invitation links. Prod `https://challenge.kickstake.app`. |
| `CORS_ORIGIN` | API | Must include the challenge origin alongside the football one (exact origins, comma-separated). Also drives Better Auth trusted origins and the challenge CSRF origin check. |
| `NEXT_PUBLIC_CHALLENGE_APP_URL` | Web (build arg) | Exact host for the `/` → `/challenges` rewrite + challenge metadata. Unset locally. |
| `CHALLENGE_NOW` | API, dev only | Pin challenge server time (ISO instant) to preview later weeks. Ignored in production. |
| `CHALLENGE_REMINDERS_CRON` | API | Schedule for the reminder job (default `*/15 * * * *`). The job is idempotent, so this only changes how soon a due reminder goes out. |
| `CHALLENGE_REMINDERS_ENABLED` | API | `false` stops automatic reminders; organiser-sent ones still work. |
| `CHALLENGE_DIGEST_CRON` | API | Schedule for the leaderboard-digest job (default `*/15 * * * *`). The cadence itself is a per-challenge organiser setting. |
| `CHALLENGE_DIGEST_ENABLED` | API | `false` stops scheduled digests; "Send leaderboard now" still works. |

**Run it locally**

```bash
pnpm postgres:dev && pnpm db:seed
pnpm --filter @kickstake/api dev   # OTP codes print here
pnpm --filter @kickstake/web dev
# Sign in once at http://localhost:3800/login, then create the challenge:
pnpm --filter @kickstake/api db:challenge:bootstrap --organiser-email you@example.com
#   → prints the invitation link (…/challenges/join/<token>)
# Optional dev-only demo challenge (week 1 elapsed, week 2 current):
pnpm --filter @kickstake/api db:challenge:bootstrap --organiser-email you@example.com --demo
```

The bootstrap command is explicit and idempotent: it never runs on deploy,
never grants ownership to "whoever registered first", refuses to reassign an
existing challenge and fails clearly if the organiser account doesn't exist.

**Reminder emails**

People who haven't entered a week's total get one email per week, in the
language they use the app in. It goes out at the week's reporting time (the
following Monday, 12:00 local) — or six hours before the final cutoff for the
last week, since that week's reporting time *is* the cutoff. The job runs
every 15 minutes and claims each (member, week) before sending, so restarts
and retries can't email anyone twice, and it stops once entries close. People
who have already entered, opted out (menu → *Turn off email reminders*) or
been removed are never emailed.

**Leaderboard emails**

Everyone gets the current leaderboard — their own position, the top of the
board, and the group's total — on **Thursday and Sunday evenings (18:00
local)**. That is capped at twice a week by design, and deliberately avoids
Monday, which is reminder day, so nobody gets two emails at once. Organisers
choose the cadence per challenge in **Manage → Leaderboard emails** (twice
weekly / weekly / off) and can send one immediately. Each member can opt out
separately from reminders (menu → *Turn off leaderboard emails*). Scheduled
sends are claimed per member and send slot, so the job is safe to re-run.

Organisers can also nudge from **Manage → Reminders**: everyone who is
missing that week, or one person from their roster card. Manual nudges are
repeatable and still skip people who entered or opted out. Sending needs
`RESEND_API_KEY`; without it the email is logged to the API console.

See [`planning/challenge-launch-checklist.md`](./planning/challenge-launch-checklist.md)
for the Render/DNS launch steps.

## Deployment

`render.yaml` defines the **production** services only (`kickstake-db-prod`,
`kickstake-api-prod`, `kickstake-web-prod`), all deploying from `main`. The
API container runs migrations on start.
