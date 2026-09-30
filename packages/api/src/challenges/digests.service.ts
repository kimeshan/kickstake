import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  activityChallenge,
  activityChallengeDigest,
  activityChallengeMember,
  activityChallengeWeek,
  user,
} from "../db/schema";
import { challengeUrl } from "../constants";
import { sendChallengeDigestEmail, type DigestRow } from "../email/email";
import { ChallengeClock } from "./clock";
import { scoringRules } from "./scoring";
import { buildStandings, type StandingsEntry } from "./standings";
import { challengeTiming, zonedToUtc, type WeekWindow } from "./timing";

type Challenge = typeof activityChallenge.$inferSelect;

/** Local hour the digest goes out. Evening, so the day's activity counts. */
const SEND_HOUR = 18;
/**
 * Thursday (4) and Sunday (7) — roughly every three days, and deliberately
 * NOT Monday, which is when the "you haven't entered" reminder lands.
 * Sunday evening doubles as the last nudge before the week closes.
 */
const TWICE_WEEKLY_DAYS = [4, 7];
const WEEKLY_DAYS = [7];
/** How long after a slot the job may still send (covers downtime). */
const SEND_WINDOW_MS = 6 * 60 * 60 * 1000;
/** Rows shown in the email before it turns into a wall of names. */
const BOARD_ROWS = 8;

export interface DigestOutcome {
  memberId: string;
  sent: boolean;
  reason?: "opted_out" | "already_sent" | "send_failed";
}

@Injectable()
export class ChallengeDigestsService {
  private readonly log = new Logger("ChallengeDigests");

  constructor(private readonly clock: ChallengeClock) {}

  @Cron(process.env.CHALLENGE_DIGEST_CRON ?? "*/15 * * * *", { name: "challenge-digests" })
  async runDueDigests() {
    if (process.env.CHALLENGE_DIGEST_ENABLED === "false") return [];
    try {
      const sent = await this.sendDueDigests();
      if (sent.length) this.log.log(`Sent ${sent.length} leaderboard digest(s).`);
      return sent;
    } catch (err) {
      this.log.error(`Digest run failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /** Local calendar date + ISO weekday (Mon = 1 … Sun = 7) in `timeZone`. */
  private localDay(now: Date, timeZone: string): { date: string; weekday: number } {
    const date = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    return { date, weekday: weekday === 0 ? 7 : weekday };
  }

  /** The digest slot due right now for this challenge, if any. */
  private dueSlot(challenge: Challenge, now: Date): string | null {
    const days =
      challenge.digestCadence === "twice_weekly"
        ? TWICE_WEEKLY_DAYS
        : challenge.digestCadence === "weekly"
          ? WEEKLY_DAYS
          : [];
    if (!days.length) return null;
    const { date, weekday } = this.localDay(now, challenge.timeZone);
    if (!days.includes(weekday)) return null;
    const slotAt = zonedToUtc(date, challenge.timeZone, SEND_HOUR).getTime();
    if (now.getTime() < slotAt || now.getTime() > slotAt + SEND_WINDOW_MS) return null;
    return `${date}T${String(SEND_HOUR).padStart(2, "0")}`;
  }

  async sendDueDigests(): Promise<DigestOutcome[]> {
    const now = this.clock.now();
    const challenges = await db.select().from(activityChallenge);
    const outcomes: DigestOutcome[] = [];

    for (const challenge of challenges) {
      const timing = challengeTiming(challenge, now);
      // Only while the challenge is live: nothing before it starts, and
      // nothing once entries have closed.
      if (timing.phase === "upcoming" || !timing.beforeCutoff) continue;
      const slot = this.dueSlot(challenge, now);
      if (!slot) continue;
      outcomes.push(...(await this.send(challenge, slot, "scheduled", null)));
    }
    return outcomes;
  }

  /** Owner-triggered "send the leaderboard now" — not slot-constrained. */
  async sendNow(challenge: Challenge, actorId: string): Promise<DigestOutcome[]> {
    const now = this.clock.now();
    const slot = `manual-${now.toISOString()}`;
    return this.send(challenge, slot, "organiser", actorId);
  }

  private async send(
    challenge: Challenge,
    slot: string,
    trigger: "scheduled" | "organiser",
    sentBy: string | null,
  ): Promise<DigestOutcome[]> {
    const timing = challengeTiming(challenge, this.clock.now());
    const week = timing.weeks[timing.defaultWeek - 1];
    const rules = scoringRules(challenge.scoringVersion);

    const members = await db
      .select({ member: activityChallengeMember, email: user.email })
      .from(activityChallengeMember)
      .innerJoin(user, eq(user.id, activityChallengeMember.userId))
      .where(
        and(
          eq(activityChallengeMember.challengeId, challenge.id),
          isNull(activityChallengeMember.removedAt),
        ),
      );
    if (!members.length) return [];

    const rows = await db
      .select()
      .from(activityChallengeWeek)
      .innerJoin(
        activityChallengeMember,
        eq(activityChallengeMember.id, activityChallengeWeek.memberId),
      )
      .where(
        and(
          eq(activityChallengeMember.challengeId, challenge.id),
          isNull(activityChallengeMember.removedAt),
        ),
      );

    const { entries, aggregates } = buildStandings({
      weekNumber: week.weekNumber,
      weekCount: challenge.weekCount,
      rules,
      members: members.map(({ member }) => ({
        id: member.id,
        userId: member.userId,
        displayName: member.displayName,
      })),
      rows: rows.map((r) => ({
        memberId: r.activity_challenge_week.memberId,
        weekNumber: r.activity_challenge_week.weekNumber,
        minutes: r.activity_challenge_week.minutes,
        updateSource: r.activity_challenge_week.updateSource,
      })),
      viewerUserId: null,
    });

    const out: DigestOutcome[] = [];
    for (const { member, email } of members) {
      if (member.digestOptOut) {
        out.push({ memberId: member.id, sent: false, reason: "opted_out" });
        continue;
      }
      const [claim] = await db
        .insert(activityChallengeDigest)
        .values({ memberId: member.id, slot, trigger, sentBy, sentAt: this.clock.now() })
        .onConflictDoNothing({
          target: [activityChallengeDigest.memberId, activityChallengeDigest.slot],
          where: eq(activityChallengeDigest.trigger, "scheduled"),
        })
        .returning();
      if (!claim) {
        out.push({ memberId: member.id, sent: false, reason: "already_sent" });
        continue;
      }
      const locale = member.locale;
      const toRow = (e: StandingsEntry): DigestRow => ({
        rank: e.rank,
        name: e.displayName,
        minutes: e.minutes === null ? null : formatNumber(e.minutes, locale),
        level: e.level === null ? null : `L${e.level}`,
        isMe: e.memberId === member.id,
      });
      try {
        await sendChallengeDigestEmail({
          to: email,
          locale,
          name: member.displayName,
          title: challenge.title,
          weekNumber: week.weekNumber,
          range: formatRange(week, locale),
          baseline: formatNumber(rules.baselineMinutes, locale),
          groupMinutes: formatNumber(aggregates.groupMinutes, locale),
          atBaseline: aggregates.atBaselineCount,
          activeCount: aggregates.activeCount,
          rows: entries.slice(0, BOARD_ROWS).map(toRow),
          you: entries.filter((e) => e.memberId === member.id).map(toRow)[0] ?? null,
          url: challengeUrl(challenge.id),
        });
        out.push({ memberId: member.id, sent: true });
      } catch (err) {
        await db.delete(activityChallengeDigest).where(eq(activityChallengeDigest.id, claim.id));
        this.log.error(`Digest to member ${member.id} failed: ${err instanceof Error ? err.message : err}`);
        out.push({ memberId: member.id, sent: false, reason: "send_failed" });
      }
    }
    return out;
  }
}

function calendarDate(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function formatRange(w: WeekWindow, locale: string) {
  const fmt = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
  try {
    return fmt.formatRange(calendarDate(w.startDate), calendarDate(w.endDate));
  } catch {
    return `${fmt.format(calendarDate(w.startDate))} – ${fmt.format(calendarDate(w.endDate))}`;
  }
}

function formatNumber(n: number, locale: string) {
  return new Intl.NumberFormat(locale).format(n);
}
