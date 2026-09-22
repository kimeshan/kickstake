# KickStake Challenge — launch checklist (Render + DNS)

Everything below touches live infrastructure and must be done by someone with
Render and DNS access. None of it was performed or verified by the code
changes; tick items off as they're confirmed.

## 1. Deploy the API + schema first

- [ ] Merge the challenge PRs to `main`. `kickstake-api-prod` rebuilds; its
      container runs `node dist/db/migrate.js` before starting. Migration
      `0007` is **additive only** (four new tables + one enum) — no existing
      table changes.
- [ ] Before merging, optionally rehearse the migration on a copy of prod
      (restore a Render backup into a scratch DB and run
      `DATABASE_URL=… node dist/db/migrate.js`).
- [ ] In the Render dashboard, confirm the API env vars match `render.yaml`
      (blueprint changes may need a manual sync):
  - `CORS_ORIGIN=https://kickstake.app,https://challenge.kickstake.app`
    (keep the football origin; add any `www` origin **only** if it serves
    the app rather than redirecting)
  - `CHALLENGE_APP_URL=https://challenge.kickstake.app`
  - unchanged: `BETTER_AUTH_URL=https://api.kickstake.app`,
    `COOKIE_DOMAIN=.kickstake.app`
- [ ] `GET https://api.kickstake.app/health` → `{"status":"ok"}`.

## 2. Web service + subdomain

- [ ] Add `challenge.kickstake.app` as a custom domain on
      **kickstake-web-prod** (Render → Settings → Custom Domains). Render
      shows the exact DNS target — use that value, don't guess the
      `onrender.com` hostname.
- [ ] At the DNS provider, create the `challenge` record exactly as Render
      instructs (typically a CNAME to the service's Render hostname).
- [ ] Wait for Render to verify the domain and issue the TLS certificate.
- [ ] Confirm `NEXT_PUBLIC_CHALLENGE_APP_URL=https://challenge.kickstake.app`
      is set on the web service, then **redeploy** (it is inlined at build
      time via the Dockerfile build arg).

## 3. Bootstrap the challenge

- [ ] The organiser signs in once at https://challenge.kickstake.app/login
      with their email (creates + verifies the account).
- [ ] From a Render shell on `kickstake-api-prod`:
      `node dist/challenges/bootstrap.js --organiser-email <organiser email>`
      (or `--organiser-id <user id>`). It prints the invitation link. Safe to
      re-run; it never touches entries.

## 4. Smoke test (phone first)

Challenge host:
- [ ] `https://challenge.kickstake.app/` shows the challenge home (title
      "KickStake Challenge").
- [ ] Open the invitation link in a private window → email code arrives
      (Resend) → sign in → name → Join → My progress.
- [ ] Save 150, then 200 → shows 200. Reload → still 200.
- [ ] Group and Rules render; no emails visible.
- [ ] Sign out → sign back in returns to the challenge, not `/dashboard`.
- [ ] Repeat the invite + sign-in inside WhatsApp's in-app browser (iOS and
      Android). If the session doesn't stick, tell people to use "Open in
      browser" — the email code works without popups.
- [ ] Organiser: Manage page loads; Copy link / Copy summary work; CSV
      downloads.

Football host (regression):
- [ ] `https://kickstake.app/` still shows the football landing page.
- [ ] Football login → `/dashboard`, create/open a sweepstake, `/j/:token`
      join still works.

## 5. Spreadsheet transition

- [ ] Post in the group: stop updating the spreadsheet; use the link.
- [ ] Keep the sheet as a read-only archive. If totals must be migrated, the
      organiser enters them via Manage → "Add or correct a total" with a
      reason (audited). Never match accounts by display name alone.

## Rollback

A web rollback leaves the additive challenge tables and their data intact.
The football product doesn't read them.
