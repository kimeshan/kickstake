# KickStake — Build Spec v1

**Domain:** kickstake.app
**One-liner:** Create a football tournament sweepstake, share a link, and let the app run the draw and the prizes for you.
**Status:** Ready to hand to Claude Code.

This is the build-ready spec. It folds in the four product decisions, pre-seeds the 2026 FIFA World Cup, and defines the data model, screens, logic, API, and acceptance criteria for an MVP. Background and historical analysis live in `Sweepstake App — Product Plan v1.md`.

---

## 0. Locked decisions

1. **Money is tracking-only.** KickStake never processes payments. It records the buy-in, tracks who has paid (organiser toggles a flag), and produces a final settlement summary. Actual payment happens off-app (EFT/cash/WhatsApp).
2. **Auto-settle with mandatory approval.** Where a results source is available, the app pre-fills each prize's winning team/participant, but every prize result starts as `pending_approval`. Nothing is final until the organiser approves. The organiser can manually edit/override **every** prize result regardless of what the data source suggests.
3. **International football tournaments only** for v1. Ship with the **2026 FIFA World Cup pre-seeded** (teams + the 12-group draw, see Appendix A). Architecture must allow adding future tournaments as data.
4. **Name:** KickStake. Verb it freely in copy ("Start a KickStake", "your KickStake link").

---

## 1. Roles

- **Organiser** — creates the sweepstake, sets buy-in/pot, configures prizes, runs the draw, marks payments, approves/edits prize results.
- **Participant** — joins via link (no account needed), confirms their name, sees their drawn teams and live winnings.

Auth: organisers get lightweight magic-link auth. Participants join with just a name + the share link (optionally an email for notifications). No passwords anywhere.

---

## 2. Sweepstake lifecycle (status machine)

`draft` → `open` → `drawn` → `live` → `settled`

- **draft** — organiser configuring; not yet shareable.
- **open** — join link live; participants joining; buy-ins tracked. Draw not yet run.
- **drawn** — teams randomly assigned to participants; assignments locked and visible.
- **live** — tournament underway; results being recorded; prizes settling (pending approval).
- **settled** — all prizes approved; final winnings + settlement summary shown.

Guardrails: can't run the draw until status is `open` and ≥2 participants exist. Once `drawn`, participants are locked (no new joiners) unless organiser explicitly reopens before drawing.

---

## 3. Core flows

### 3.1 Create (organiser)
1. Choose tournament → **2026 FIFA World Cup** (pre-seeded). Loads 48 teams across 12 groups.
2. Set **buy-in per person** and optional **extra pot donation**. Pot = (buy-in × participants) + donation. Because participant count isn't final at creation, organiser sets an **expected pot** to design prizes against; the prize amounts are stored as a structure that reconciles to the chosen pot, and the app shows a warning if the final pot differs from the designed pot at draw time (with a one-click rescale).
3. App **auto-generates a prize structure** from the pot (see §5). Editable; live reconciliation enforces total = pot.
4. Generate **share link** (`kickstake.app/j/{token}`) + QR code.

### 3.2 Join (participant)
1. Open link → see tournament, buy-in, pot, prize list, current participants, draw status.
2. Enter name (+ optional email) → join.
3. See "You're in — waiting for the draw," or drawn teams if already `drawn`.

### 3.3 Draw (organiser)
1. When ready, organiser hits **Run Draw**. Requires `open` + ≥2 participants.
2. App distributes all 48 teams across participants (§4). Stores the **random seed** for auditability.
3. Status → `drawn`. Everyone can see all assignments. Optional animated reveal.

### 3.4 Run the tournament (organiser)
1. Status → `live`. Record results (manual entry for MVP; auto-pull is fast-follow).
2. App computes each prize's winning team → owner, sets result to `pending_approval` with the suggestion pre-filled.
3. Organiser reviews, edits if needed, and approves each. Approved results show on the live winnings leaderboard.

### 3.5 Settle
1. When all prizes approved → status `settled`.
2. Show winnings per participant and a **settlement summary** (each participant's net: winnings − buy-in).

---

## 4. The draw algorithm

- Input: N participants, T teams (T=48 for WC2026), a random seed.
- Default: distribute teams as evenly as possible. Each participant gets `floor(T/N)` teams; the `T mod N` remainder teams are distributed one each to randomly chosen participants (fairest), **or** sent to the pot — organiser picks the remainder policy at draw time (`spread_fairly` default, or `to_pot`).
- Teams assigned to the pot have `participant_id = null` (mirrors your historical "N/A" teams). Pot-owned prizes are won by nobody (stay in the pot / roll to organiser's chosen rule — for MVP just display "Pot").
- Store the seed + algorithm version so the draw is reproducible and provably fair. Provide a "How the draw worked" explainer.

---

## 5. Auto prize generation

Goal: given a pot and the tournament's group count G (12 for WC2026), produce a balanced allocation that **always sums to exactly the pot**, editable by the organiser with live reconciliation.

Default template (percentages of pot, derived from the historical Euro sweepstakes which both reconciled to 100%):

| Category | Rule type | Default share | Per-group? |
|---|---|---|---|
| Winner | `winner` | 25% | no |
| Runner-up | `runner_up` | 13% | no |
| Bronze (3rd-place playoff winner) | `third_place` | 5% | no |
| Top of group | `group_top` | 15% total (split across G groups) | yes |
| Bottom of group | `group_bottom` | 12% total (split across G groups) | yes |
| Player of the Tournament | `player_of_tournament` | 4% | no |
| Golden Boot (top scorer) | `golden_boot` | 4% | no |
| Dirtiest team (15pt red / 10pt yellow) | `most_cards` | 4% | no |
| Best defence (lowest avg conceded) | `least_conceded` | 5% | no |
| Most possession | `most_possession` | 4% | no |
| Least possession | `least_possession` | 4% | no |
| Biggest single-game loss | `biggest_loss` | 5% | no |

Notes:
- Percentages are the *default*; organiser edits any amount. A reconciliation bar shows allocated vs. pot and blocks saving unless they're equal (with an "auto-balance remainder" helper).
- Per-group prizes: the category's total share is divided across G groups; rounding remainder goes to the first group (or organiser adjusts). With G=12 these are small per-group amounts — surface a note so the organiser can choose to fund only Top/Bottom for a subset of groups or fold the budget elsewhere.
- Comedy categories are individually toggleable; toggling off redistributes its share to the reconciliation remainder.
- Rounding: all amounts to the currency's minor unit; the reconciliation step guarantees the sum equals the pot exactly.

---

## 6. Data model

```
Tournament      id, name, year, group_count, team_count, format (enum), data_source_id, status
Team            id, tournament_id, name, group_label, flag_code
Sweepstake      id, organiser_id, tournament_id, name, currency, buy_in, donation,
                designed_pot, status (enum), join_token, draw_seed, draw_algo_version,
                remainder_policy (enum), created_at
Participant     id, sweepstake_id, display_name, email (nullable), paid (bool),
                amount_due, joined_at
TeamAssignment  id, sweepstake_id, team_id, participant_id (nullable = pot)
PrizeCategory   id, sweepstake_id, label, description, rule_type (enum), amount,
                per_group (bool), enabled (bool)
PrizeResult     id, prize_category_id, group_label (nullable, for per-group),
                winning_team_id (nullable), winning_participant_id (nullable),
                status (enum: pending_approval | approved | manual_override),
                approved_by, approved_at
Organiser       id, email, magic_link fields
```

Rule-type enum: `winner, runner_up, third_place, group_top, group_bottom, player_of_tournament, golden_boot, most_cards, least_conceded, most_possession, least_possession, biggest_loss, custom`.

---

## 7. Screens

**Organiser**
- Dashboard — list of my sweepstakes by status.
- Create wizard — tournament → pot/buy-in → prize editor (with reconciliation bar) → share.
- Sweepstake detail — participants + paid toggles, pot meter, share link/QR, "Run Draw".
- Draw result — all team→person assignments, "how it worked" explainer.
- Results console — per prize category: suggested winner, edit/override, approve. Bulk-approve.
- Settlement — winnings per person + net settlement summary; export/share.

**Participant**
- Join page — sweepstake summary + join form.
- My page — my teams, my live winnings, overall leaderboard, prize list.

Mobile-first throughout (primary context is a phone in a WhatsApp/family group).

---

## 8. API surface (REST, Next.js route handlers)

```
POST   /api/sweepstakes                  create (draft)
GET    /api/sweepstakes/:id              detail (organiser)
PATCH  /api/sweepstakes/:id              update config / status transitions
POST   /api/sweepstakes/:id/prizes:generate   auto-generate prize structure from pot
PUT    /api/sweepstakes/:id/prizes       save edited prize structure (validates = pot)
POST   /api/sweepstakes/:id/draw         run the draw (seed, remainder_policy)
GET    /api/j/:token                     public join view
POST   /api/j/:token/participants        join (name, email?)
PATCH  /api/participants/:id             organiser: toggle paid
POST   /api/sweepstakes/:id/results:compute   recompute suggestions → pending_approval
PATCH  /api/prize-results/:id            edit/override/approve a single result
GET    /api/sweepstakes/:id/settlement   winnings + net summary
```

Authz: organiser endpoints require the owning organiser's session; join/view endpoints are public by token.

---

## 9. Tech stack

- **Next.js (App Router) + TypeScript** — UI + API in one repo.
- **Supabase** — Postgres, row-level security, magic-link auth for organisers.
- **Tailwind + shadcn/ui** — mobile-first.
- **Hosting:** Vercel, domain kickstake.app.
- **Results data (fast-follow):** API-Football or football-data.org, cached server-side; manual entry is the MVP path and always remains the override.
- **Notifications (fast-follow):** Resend for email.

---

## 10. MVP scope

**In:** create → auto prize table (editable, reconciling) → share link + QR → participants join → paid tracking → random draw with seed → assignments view → manual results entry → auto-suggested prize winners with mandatory organiser approval/override → live winnings leaderboard → settlement summary. WC2026 pre-seeded. Tracking-only money. Mobile-first.

**Fast-follow:** auto results pull from sports API, animated draw reveal, email notifications, buy-in reminders, organiser multi-sweepstake dashboard polish.

**Later:** more tournaments (Euro 2028, club competitions), historical archive, richer pot/remainder rules.

---

## 11. Acceptance criteria

1. An organiser can create a WC2026 sweepstake, and the prize editor refuses to save unless allocations sum exactly to the pot.
2. Auto-generated prizes for a R2000-equivalent pot reproduce a sensible split (Winner largest, comedy categories present, per-group prizes spread across all 12 groups).
3. A participant can join from a phone via the share link with only a name, no account.
4. Running the draw assigns all 48 teams, leaves none unassigned (under `spread_fairly`), stores a seed, and the same seed reproduces the same draw.
5. Every prize result appears as `pending_approval` with a suggestion and cannot count toward winnings until approved; the organiser can override the winner of any prize.
6. The settlement view shows, per participant, total winnings and net (winnings − buy-in), and the sum of all prize amounts equals the pot.
7. Paid/unpaid status is editable per participant and reflected in settlement.
8. Status transitions enforce the guardrails in §2 (e.g. no draw without ≥2 participants).

---

## Appendix A — 2026 FIFA World Cup seed data

**Format:** 48 teams, 12 groups of 4. Top 2 of each group + 8 best third-placed teams advance to a Round of 32, then standard knockouts (R16 → QF → SF → 3rd-place playoff → Final). Hosts: USA, Canada, Mexico. Group count G = 12. Kickoff June 11, 2026.

| Group | Teams |
|---|---|
| A | Mexico, South Korea, South Africa, Czechia |
| B | Canada, Switzerland, Qatar, Bosnia-Herzegovina |
| C | Brazil, Morocco, Scotland, Haiti |
| D | USA, Paraguay, Australia, Türkiye |
| E | Germany, Ecuador, Ivory Coast, Curaçao |
| F | Netherlands, Japan, Tunisia, Sweden |
| G | Belgium, Iran, Egypt, New Zealand |
| H | Spain, Uruguay, Saudi Arabia, Cape Verde |
| I | France, Senegal, Norway, Iraq |
| J | Argentina, Austria, Algeria, Jordan |
| K | Portugal, Colombia, Uzbekistan, DR Congo |
| L | England, Croatia, Panama, Ghana |

*Verify against the official FIFA source at build time in case of any post-draw changes; seed from the official feed if possible rather than hardcoding.*
