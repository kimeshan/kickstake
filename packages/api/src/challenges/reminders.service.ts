import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import {
  activityChallenge,
  activityChallengeMember,
  activityChallengeReminder,
  activityChallengeWeek,
  user,
} from "../db/schema";
import { challengeUrl } from "../constants";
import { sendChallengeReminderEmail } from "../email/email";
import { ChallengeClock } from "./clock";
import { scoringRules } from "./scoring";
import { challengeTiming, type ChallengeTiming, type WeekWindow } from "./timing";

type Challenge = typeof activityChallenge.$inferSelect;
type Member = typeof activityChallengeMember.$inferSelect;

/** How long after a week's due time the automatic job may still send. */
const SEND_WINDOW_MS = 48 * 60 * 60 * 1000;
/** For the final week the reporting request lands on the cutoff itself, so
 *  send a few hours earlier — a nudge after editing closed is useless. */
const FINAL_WEEK_LEAD_MS = 6 * 60 * 60 * 1000;

export interface ReminderOutcome {
  memberId: string;
  sent: boolean;
  reason?: "already_entered" | "opted_out" | "not_a_member" | "send_failed" | "already_reminded";
}

@Injectable()
export class ChallengeRemindersService {
  private readonly log = new Logger("ChallengeReminders");

  constructor(private readonly clock: ChallengeClock) {}

  /**
   * Weekly nudge to people who haven't entered a total yet. Runs often and
   * is idempotent: each (member, week) can only be claimed once thanks to
   * the partial unique index, so extra runs and retries can't double-send.
   */
  @Cron(process.env.CHALLENGE_REMINDERS_CRON ?? "*/15 * * * *", { name: "challenge-reminders" })
  async runDueReminders() {
    if (process.env.CHALLENGE_REMINDERS_ENABLED === "false") return [];
    try {
      const sent = await this.sendDueReminders();
      if (sent.length) this.log.log(`Sent ${sent.length} weekly reminder(s).`);
      return sent;
    } catch (err) {
      // Never let a reminder failure take down the scheduler.
      this.log.error(`Reminder run failed: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  /** When the automatic reminder for `week` is due (UTC instant). */
  private dueAt(w: WeekWindow, timing: ChallengeTiming): number {
    const reporting = Date.parse(w.reportingDueAt);
    const cutoff = Date.parse(timing.finalEditCutoff);
    // The last week's request lands on the cutoff — send before it closes.
    return Math.min(reporting, cutoff - FINAL_WEEK_LEAD_MS);
  }

  async sendDueReminders(): Promise<ReminderOutcome[]> {
    const now = this.clock.now();
    const challenges = await db.select().from(activityChallenge);
    const outcomes: ReminderOutcome[] = [];

    for (const challenge of challenges) {
      const timing = challengeTiming(challenge, now);
      // Once entries close there's nothing to nudge anyone about.
      if (!timing.beforeCutoff) continue;

      for (const w of timing.weeks) {
        if (w.status !== "elapsed") continue;
        const due = this.dueAt(w, timing);
        if (now.getTime() < due || now.getTime() > due + SEND_WINDOW_MS) continue;
        outcomes.push(
          ...(await this.remind(challenge, w, await this.missingMembers(challenge.id, w.weekNumber), {
            kind: "automatic",
            sentBy: null,
          })),
        );
      }
    }
    return outcomes;
  }

  /** Active, opted-in members with no total for `weekNumber`. */
  private async missingMembers(challengeId: string, weekNumber: number) {
    return db
      .select({ member: activityChallengeMember, email: user.email })
      .from(activityChallengeMember)
      .innerJoin(user, eq(user.id, activityChallengeMember.userId))
      .innerJoin(
        activityChallengeWeek,
        and(
          eq(activityChallengeWeek.memberId, activityChallengeMember.id),
          eq(activityChallengeWeek.weekNumber, weekNumber),
        ),
      )
      .where(
        and(
          eq(activityChallengeMember.challengeId, challengeId),
          isNull(activityChallengeMember.removedAt),
          eq(activityChallengeMember.remindersOptOut, false),
          isNull(activityChallengeWeek.minutes),
        ),
      );
  }

  /**
   * Claims each (member, week) before sending, and releases the claim if the
   * send fails so the next run retries — rather than recording a send that
   * never happened.
   */
  private async remind(
    challenge: Challenge,
    w: WeekWindow,
    recipients: { member: Member; email: string }[],
    opts: { kind: "automatic" | "organiser"; sentBy: string | null },
  ): Promise<ReminderOutcome[]> {
    const rules = scoringRules(challenge.scoringVersion);
    const timing = challengeTiming(challenge, this.clock.now());
    const out: ReminderOutcome[] = [];

    for (const { member, email } of recipients) {
      const [claim] = await db
        .insert(activityChallengeReminder)
        .values({
          memberId: member.id,
          weekNumber: w.weekNumber,
          kind: opts.kind,
          sentBy: opts.sentBy,
          sentAt: this.clock.now(),
        })
        // `where` is the partial index predicate: only automatic rows collide.
        .onConflictDoNothing({
          target: [activityChallengeReminder.memberId, activityChallengeReminder.weekNumber],
          where: eq(activityChallengeReminder.kind, "automatic"),
        })
        .returning();
      if (!claim) {
        out.push({ memberId: member.id, sent: false, reason: "already_reminded" });
        continue;
      }
      try {
        await sendChallengeReminderEmail({
          to: email,
          locale: member.locale,
          name: member.displayName,
          title: challenge.title,
          weekNumber: w.weekNumber,
          range: formatRange(w, member.locale),
          baseline: formatNumber(rules.baselineMinutes, member.locale),
          deadline: formatInstant(timing.finalEditCutoff, member.locale, challenge.timeZone),
          url: challengeUrl(challenge.id),
        });
        out.push({ memberId: member.id, sent: true });
      } catch (err) {
        await db.delete(activityChallengeReminder).where(eq(activityChallengeReminder.id, claim.id));
        this.log.error(`Reminder to member ${member.id} failed: ${err instanceof Error ? err.message : err}`);
        out.push({ memberId: member.id, sent: false, reason: "send_failed" });
      }
    }
    return out;
  }

  /**
   * Organiser-triggered nudge for one or more people. Repeatable (unlike the
   * automatic one) and it still skips people who opted out or already
   * entered a total for that week.
   */
  async sendManual(
    challenge: Challenge,
    weekNumber: number,
    memberIds: string[],
  ): Promise<ReminderOutcome[]> {
    const timing = challengeTiming(challenge, this.clock.now());
    const w = timing.weeks[weekNumber - 1];
    const missing = await this.missingMembers(challenge.id, weekNumber);
    const byId = new Map(missing.map((r) => [r.member.id, r]));

    const members = await db
      .select()
      .from(activityChallengeMember)
      .where(
        and(
          eq(activityChallengeMember.challengeId, challenge.id),
          inArray(activityChallengeMember.id, memberIds),
        ),
      );
    const known = new Map(members.map((m) => [m.id, m]));

    const out: ReminderOutcome[] = [];
    const recipients: { member: Member; email: string }[] = [];
    for (const id of memberIds) {
      const member = known.get(id);
      if (!member || member.removedAt) {
        out.push({ memberId: id, sent: false, reason: "not_a_member" });
      } else if (member.remindersOptOut) {
        out.push({ memberId: id, sent: false, reason: "opted_out" });
      } else if (!byId.has(id)) {
        out.push({ memberId: id, sent: false, reason: "already_entered" });
      } else {
        recipients.push(byId.get(id)!);
      }
    }
    return [...out, ...(await this.remind(challenge, w, recipients, { kind: "organiser", sentBy: null }))];
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

function formatInstant(iso: string, locale: string, timeZone: string) {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "short",
  }).format(new Date(iso));
}

function formatNumber(n: number, locale: string) {
  return new Intl.NumberFormat(locale).format(n);
}
