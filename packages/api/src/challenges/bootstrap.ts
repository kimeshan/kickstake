/**
 * Explicit, idempotent challenge bootstrap. Never runs on deploy.
 *
 *   pnpm --filter @kickstake/api db:challenge:bootstrap --organiser-email you@example.com
 *   node dist/challenges/bootstrap.js --organiser-id <user id>          (production image)
 *
 * The organiser must already have a KickStake account (sign in once first);
 * ownership is never granted to "whoever registers first".
 *
 * --demo (dev/e2e only) creates a separate "demo-level-up" challenge whose
 * week 1 started last Monday, so there is an elapsed week to backfill and a
 * current week in progress. Re-running re-anchors its dates to today.
 */
import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { activityChallenge, user } from "../db/schema";
import { challengeInviteUrl } from "../constants";
import { INITIAL_CHALLENGE } from "./config";
import { newJoinToken } from "./challenges.service";
import { ACTIVITY_MINUTES_V1 } from "./scoring";
import { addDays, zonedToUtc } from "./timing";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function resolveOrganiser(): Promise<{ id: string; email: string }> {
  const id = arg("organiser-id");
  const email = arg("organiser-email")?.trim().toLowerCase();
  if (!id && !email) throw new Error("Pass --organiser-id <user id> or --organiser-email <email>.");
  const [u] = await db
    .select({ id: user.id, email: user.email, emailVerified: user.emailVerified })
    .from(user)
    .where(id ? eq(user.id, id) : eq(user.email, email!));
  if (!u)
    throw new Error(
      `No KickStake account for ${id ?? email}. Sign in once with that email, then re-run.`,
    );
  if (!id && !u.emailVerified)
    throw new Error(`${email} has not verified its email yet. Sign in with the emailed code first.`);
  return u;
}

/** Monday (local date) of the week containing `now` in `timeZone`. */
function mondayOf(now: Date, timeZone: string): string {
  const local = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  const dow = (new Date(`${local}T00:00:00Z`).getUTCDay() + 6) % 7; // Mon = 0
  return addDays(local, -dow);
}

function demoConfig() {
  if (process.env.NODE_ENV === "production") throw new Error("--demo is disabled in production.");
  const timeZone = INITIAL_CHALLENGE.timeZone;
  const weekCount = 4;
  const startDate = addDays(mondayOf(new Date(), timeZone), -7);
  return {
    slug: "demo-level-up",
    title: "Demo Level Up",
    startDate,
    weekCount,
    timeZone,
    finalEditCutoff: zonedToUtc(addDays(startDate, weekCount * 7), timeZone, 12),
    scoringVersion: ACTIVITY_MINUTES_V1.version,
  };
}

async function main() {
  const organiser = await resolveOrganiser();
  const demo = process.argv.includes("--demo");
  const cfg = demo ? demoConfig() : INITIAL_CHALLENGE;

  const [existing] = await db
    .select()
    .from(activityChallenge)
    .where(eq(activityChallenge.slug, cfg.slug));

  if (existing) {
    if (existing.organiserId !== organiser.id)
      throw new Error(
        `Challenge "${cfg.slug}" already exists with a different organiser. Refusing to reassign.`,
      );
    if (demo) {
      await db
        .update(activityChallenge)
        .set({ startDate: cfg.startDate, finalEditCutoff: cfg.finalEditCutoff, updatedAt: new Date() })
        .where(eq(activityChallenge.id, existing.id));
    }
    console.log(`Challenge "${cfg.slug}" already exists (id ${existing.id}) — entries untouched.`);
    console.log(`Invitation: ${challengeInviteUrl(existing.joinToken)}`);
    return;
  }

  const [created] = await db
    .insert(activityChallenge)
    .values({ ...cfg, organiserId: organiser.id, joinToken: newJoinToken() })
    .returning();
  console.log(`Created challenge "${created.title}" (id ${created.id}) for ${organiser.email}.`);
  console.log(`Invitation: ${challengeInviteUrl(created.joinToken)}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    pool.end();
    process.exit(1);
  });
