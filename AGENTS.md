# AGENTS.md

Agent guide for the KickStake repo. LLM-agnostic — `CLAUDE.md` is a symlink to
this file. See `README.md` for setup and `planning/` for the product spec + UI
mockups.

## Stack

- pnpm + Turborepo monorepo. `packages/web` (Next 16, React 19, Tailwind 4,
  shadcn), `packages/api` (NestJS 11, Drizzle ORM, Better Auth), `packages/postgres`
  (Docker Postgres 17).
- TypeScript pinned to **^5.9, not 6.0** (Nest decorator-metadata safety).

## Environment Setup

- Local Postgres runs on host port **5437** (5432–5436 are used by other local
  projects). `docker-compose.yml` maps 5437→5432.
- Copy `packages/api/.env.example` → `.env` and `packages/web/.env.example` → `.env`.
- `pnpm postgres:dev` (start + migrate), `pnpm db:seed` (WC2026 data), `pnpm dev`.
- API Swagger is at **`/api-docs`** and health at **`/health`** — there is no
  `/api` route on the API (`/api/*` only exists on the web app at :3800).

## Project Conventions

- **Copy must be inclusive: use "group", never "family".** It has to cover
  family, friends, AND co-workers.
- UI direction is **"Matchday"**: dark near-black + electric lime; app is
  dark-only. Display font Anton, body font Hanken Grotesk.
- All money is stored as **integer minor units** (e.g. cents). KickStake is
  **tracking-only** — it never processes payments.
- Auth = Better Auth **email OTP (6-digit) + Google SSO; no passwords**. In dev
  the OTP code prints to the **API console** (no email sent unless
  `RESEND_API_KEY` is set). Google activates only when `GOOGLE_CLIENT_*` are set.
- **i18n is mandatory**: all user-facing web copy lives in
  `packages/web/messages/<locale>.json` via next-intl — never hardcode strings
  in components. 8 locales (en, es, fr, zh, hi, ar, pt, ru); `ar` is RTL.
  Locale is cookie-based (`NEXT_LOCALE`), no `[locale]` route segment. Add a key
  to **every** locale file (en is the source of truth) and keep keys in sync.

## Guardrails

- Keep `declaration: false` in `packages/api/tsconfig.json`. Declaration emit
  hits a better-auth/zod **TS2742** portability error under pnpm. This is an
  app, not a library — it never needs `.d.ts` output.

## Common Errors to Avoid

- After editing `packages/api/src/auth/*`, **fully restart `pnpm dev`**.
  `nest --watch` reads `tsconfig.json` once at startup and doesn't reliably
  reload new Better Auth routes, so auth endpoints 404 until a clean restart.
