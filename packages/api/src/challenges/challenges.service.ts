import { Injectable } from "@nestjs/common";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "../db";
import {
  activityChallenge,
  activityChallengeMember,
  activityChallengeWeek,
  activityChallengeWeekAudit,
} from "../db/schema";
import { challengeInviteUrl } from "../constants";
import { ChallengeClock } from "./clock";
import { challengeError } from "./errors";
import {
  scoringRules,
  summarise,
  weekResult,
  type ScoringRules,
  type WeekResult,
} from "./scoring";
import { challengeTiming, type ChallengeTiming, type WeekWindow } from "./timing";
import {
  isUuid,
  parseBody,
  parseDisplayName,
  parseMinutes,
  parseReason,
  parseVersion,
  parseWeek,
} from "./validation";

type Challenge = typeof activityChallenge.$inferSelect;
type Member = typeof activityChallengeMember.$inferSelect;
type WeekRow = typeof activityChallengeWeek.$inferSelect;
type Source = "participant" | "organiser";

/** Random, unguessable invitation token (~95 bits). */
export const newJoinToken = () => nanoid(16);

interface Access {
  challenge: Challenge;
  /** The caller's membership row, active or removed. */
  member: Member | null;
  isOwner: boolean;
}

@Injectable()
export class ChallengesService {
  constructor(private readonly clock: ChallengeClock) {}

  // --- Lookups + access -------------------------------------------------

  private async loadChallenge(id: string): Promise<Challenge> {
    if (!isUuid(id)) throw challengeError(404, "challenge_not_found");
    const [c] = await db.select().from(activityChallenge).where(eq(activityChallenge.id, id));
    if (!c) throw challengeError(404, "challenge_not_found");
    return c;
  }

  private async access(userId: string, challengeId: string): Promise<Access> {
    const challenge = await this.loadChallenge(challengeId);
    const [member] = await db
      .select()
      .from(activityChallengeMember)
      .where(
        and(
          eq(activityChallengeMember.challengeId, challenge.id),
          eq(activityChallengeMember.userId, userId),
        ),
      );
    return { challenge, member: member ?? null, isOwner: challenge.organiserId === userId };
  }

  /** Active member OR organiser — may read group results. */
  private async requireViewer(userId: string, challengeId: string) {
    const a = await this.access(userId, challengeId);
    if (a.isOwner) return a;
    if (!a.member) throw challengeError(403, "not_a_member");
    if (a.member.removedAt) throw challengeError(403, "membership_removed");
    return a;
  }

  /** Active member only — owns weekly entries. */
  private async requireMember(userId: string, challengeId: string) {
    const a = await this.access(userId, challengeId);
    if (!a.member) throw challengeError(403, "not_a_member");
    if (a.member.removedAt) throw challengeError(403, "membership_removed");
    return { ...a, member: a.member };
  }

  private async requireOwner(userId: string, challengeId: string) {
    const a = await this.access(userId, challengeId);
    if (!a.isOwner) throw challengeError(403, "not_organiser");
    return a;
  }

  private timing(c: Challenge): ChallengeTiming {
    return challengeTiming(c, this.clock.now());
  }

  private rules(c: Challenge): ScoringRules {
    return scoringRules(c.scoringVersion);
  }

  private async weeksFor(memberIds: string[]): Promise<WeekRow[]> {
    if (!memberIds.length) return [];
    return db
      .select()
      .from(activityChallengeWeek)
      .where(inArray(activityChallengeWeek.memberId, memberIds))
      .orderBy(asc(activityChallengeWeek.weekNumber));
  }

  private async activeMembers(challengeId: string): Promise<Member[]> {
    return db
      .select()
      .from(activityChallengeMember)
      .where(
        and(
          eq(activityChallengeMember.challengeId, challengeId),
          isNull(activityChallengeMember.removedAt),
        ),
      );
  }

  // --- Shapes -------------------------------------------------------------

  private config(c: Challenge) {
    const rules = this.rules(c);
    return {
      id: c.id,
      title: c.title,
      startDate: c.startDate,
      weekCount: c.weekCount,
      timeZone: c.timeZone,
      scoringVersion: c.scoringVersion,
      baselineMinutes: rules.baselineMinutes,
      ladder: rules.ladder,
      joiningClosed: c.joiningClosed,
      participantEditingLocked: c.participantEditingLocked,
    };
  }

  private participantCanEdit(c: Challenge, w: WeekWindow, timing: ChallengeTiming) {
    return w.status !== "future" && timing.beforeCutoff && !c.participantEditingLocked;
  }

  private weekView(
    c: Challenge,
    timing: ChallengeTiming,
    row: WeekRow | undefined,
    w: WeekWindow,
  ) {
    const minutes = row?.minutes ?? null;
    return {
      ...w,
      minutes,
      version: row?.version ?? 0,
      updatedAt: row?.updatedAt ?? null,
      updateSource: row?.updateSource ?? null,
      editable: this.participantCanEdit(c, w, timing),
      inProgress: w.status === "current",
      result: weekResult(minutes, this.rules(c)),
    };
  }

  private minutesByWeek(c: Challenge, rows: WeekRow[]): (number | null)[] {
    const out: (number | null)[] = Array.from({ length: c.weekCount }, () => null);
    for (const r of rows) if (r.weekNumber <= c.weekCount) out[r.weekNumber - 1] = r.minutes;
    return out;
  }

  // --- Invitation + join -------------------------------------------------

  private async challengeByToken(token: string): Promise<Challenge> {
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(token)) throw challengeError(404, "invitation_not_found");
    const [c] = await db
      .select()
      .from(activityChallenge)
      .where(eq(activityChallenge.joinToken, token));
    if (!c) throw challengeError(404, "invitation_not_found");
    return c;
  }

  /** Public preview. Never returns members, emails or totals. */
  async invitation(token: string, viewerId: string | null) {
    const c = await this.challengeByToken(token);
    const timing = this.timing(c);
    const rules = this.rules(c);
    let viewer: { status: "none" | "member" | "removed" | "owner"; challengeId?: string } | null =
      null;
    if (viewerId) {
      const a = await this.access(viewerId, c.id);
      const status = a.member
        ? a.member.removedAt
          ? "removed"
          : "member"
        : a.isOwner
          ? "owner"
          : "none";
      viewer = status === "member" || status === "owner" ? { status, challengeId: c.id } : { status };
    }
    const unavailableReason = !timing.beforeCutoff
      ? "challenge_ended"
      : c.joiningClosed
        ? "joining_closed"
        : null;
    return {
      title: c.title,
      startDate: c.startDate,
      lastActivityDate: timing.lastActivityDate,
      weekCount: c.weekCount,
      timeZone: c.timeZone,
      baselineMinutes: rules.baselineMinutes,
      ladder: rules.ladder,
      weeks: timing.weeks.map((w) => ({
        weekNumber: w.weekNumber,
        startDate: w.startDate,
        endDate: w.endDate,
      })),
      phase: timing.phase,
      finalEditCutoff: timing.finalEditCutoff,
      joinable: unavailableReason === null,
      unavailableReason,
      viewer,
    };
  }

  /**
   * Idempotent + transactional: one membership and exactly `weekCount` empty
   * week rows per account, however many times (or how concurrently) Join is
   * pressed. An existing active member just gets their membership back.
   */
  async join(userId: string, token: string, body: unknown) {
    const input = parseBody(body, ["displayName"]);
    const displayName = parseDisplayName(input.displayName);
    const c = await this.challengeByToken(token);

    const existing = (await this.access(userId, c.id)).member;
    if (existing) {
      if (existing.removedAt) throw challengeError(403, "membership_removed");
      return { challengeId: c.id, memberId: existing.id, displayName: existing.displayName, created: false };
    }
    const timing = this.timing(c);
    if (!timing.beforeCutoff) throw challengeError(409, "challenge_ended");
    if (c.joiningClosed) throw challengeError(409, "joining_closed");

    const created = await db.transaction(async (tx) => {
      // ON CONFLICT waits for a concurrent insert of the same (challenge, user)
      // to commit, so the loser sees nothing here and falls through to re-read.
      const [m] = await tx
        .insert(activityChallengeMember)
        .values({ challengeId: c.id, userId, displayName })
        .onConflictDoNothing({
          target: [activityChallengeMember.challengeId, activityChallengeMember.userId],
        })
        .returning();
      if (!m) return null;
      await tx.insert(activityChallengeWeek).values(
        Array.from({ length: c.weekCount }, (_, i) => ({
          memberId: m.id,
          weekNumber: i + 1,
          minutes: null,
          version: 0,
        })),
      );
      return m;
    });
    if (created)
      return { challengeId: c.id, memberId: created.id, displayName: created.displayName, created: true };

    const raced = (await this.access(userId, c.id)).member!;
    if (raced.removedAt) throw challengeError(403, "membership_removed");
    return { challengeId: c.id, memberId: raced.id, displayName: raced.displayName, created: false };
  }

  // --- Participant --------------------------------------------------------

  async mine(userId: string) {
    const memberships = await db
      .select({ member: activityChallengeMember, challenge: activityChallenge })
      .from(activityChallengeMember)
      .innerJoin(activityChallenge, eq(activityChallenge.id, activityChallengeMember.challengeId))
      .where(and(eq(activityChallengeMember.userId, userId), isNull(activityChallengeMember.removedAt)));
    const owned = await db
      .select()
      .from(activityChallenge)
      .where(eq(activityChallenge.organiserId, userId));

    const byId = new Map<string, { challenge: Challenge; displayName: string | null; isOwner: boolean; isMember: boolean }>();
    for (const { member, challenge } of memberships)
      byId.set(challenge.id, { challenge, displayName: member.displayName, isOwner: challenge.organiserId === userId, isMember: true });
    for (const challenge of owned)
      if (!byId.has(challenge.id))
        byId.set(challenge.id, { challenge, displayName: null, isOwner: true, isMember: false });

    return {
      challenges: [...byId.values()]
        .sort((a, b) => b.challenge.startDate.localeCompare(a.challenge.startDate))
        .map(({ challenge, displayName, isOwner, isMember }) => {
          const timing = this.timing(challenge);
          return {
            id: challenge.id,
            title: challenge.title,
            startDate: challenge.startDate,
            lastActivityDate: timing.lastActivityDate,
            phase: timing.phase,
            displayName,
            isOwner,
            isMember,
          };
        }),
    };
  }

  async detail(userId: string, challengeId: string) {
    const a = await this.requireViewer(userId, challengeId);
    const active = a.member && !a.member.removedAt ? a.member : null;
    return {
      ...this.config(a.challenge),
      timing: this.timing(a.challenge),
      role: {
        isOwner: a.isOwner,
        isMember: !!active,
        memberId: active?.id ?? null,
        displayName: active?.displayName ?? null,
      },
    };
  }

  async me(userId: string, challengeId: string) {
    const { challenge, member } = await this.requireMember(userId, challengeId);
    return this.progress(challenge, member);
  }

  private async progress(c: Challenge, member: Member) {
    const timing = this.timing(c);
    const rows = await this.weeksFor([member.id]);
    const byNumber = new Map(rows.map((r) => [r.weekNumber, r]));
    return {
      member: { id: member.id, displayName: member.displayName, joinedAt: member.joinedAt },
      participantEditingLocked: c.participantEditingLocked,
      timing,
      weeks: timing.weeks.map((w) => this.weekView(c, timing, byNumber.get(w.weekNumber), w)),
      summary: summarise(this.minutesByWeek(c, rows), this.rules(c)),
    };
  }

  async updateMe(userId: string, challengeId: string, body: unknown) {
    const input = parseBody(body, ["displayName"]);
    const displayName = parseDisplayName(input.displayName);
    const { member } = await this.requireMember(userId, challengeId);
    const [updated] = await db
      .update(activityChallengeMember)
      .set({ displayName })
      .where(eq(activityChallengeMember.id, member.id))
      .returning();
    return { memberId: updated.id, displayName: updated.displayName };
  }

  async saveMyWeek(userId: string, challengeId: string, weekParam: string, body: unknown) {
    const input = parseBody(body, ["minutes", "expectedVersion"]);
    const { challenge, member } = await this.requireMember(userId, challengeId);
    const weekNumber = parseWeek(weekParam, challenge.weekCount);
    const minutes = parseMinutes(input.minutes);
    const expectedVersion = parseVersion(input.expectedVersion);

    const timing = this.timing(challenge);
    const w = timing.weeks[weekNumber - 1];
    if (w.status === "future") throw challengeError(409, "week_not_started");
    if (!timing.beforeCutoff) throw challengeError(409, "editing_closed");
    if (challenge.participantEditingLocked) throw challengeError(409, "editing_locked");

    await this.writeWeek({
      memberId: member.id,
      weekNumber,
      minutes,
      expectedVersion,
      actorId: userId,
      source: "participant",
      reason: null,
    });
    return this.progress(challenge, member);
  }

  /**
   * Atomic replace-never-add write: row lock → version check → update (+1) →
   * audit, in one transaction. A stale or replayed write gets 409 with the
   * current saved value instead of silently overwriting it.
   */
  private async writeWeek(p: {
    memberId: string;
    weekNumber: number;
    minutes: number | null;
    expectedVersion: number;
    actorId: string;
    source: Source;
    reason: string | null;
  }) {
    const now = this.clock.now();
    return db.transaction(async (tx) => {
      const [row] = await tx
        .select()
        .from(activityChallengeWeek)
        .where(
          and(
            eq(activityChallengeWeek.memberId, p.memberId),
            eq(activityChallengeWeek.weekNumber, p.weekNumber),
          ),
        )
        .for("update");
      if (!row) throw challengeError(404, "invalid_week");
      if (row.version !== p.expectedVersion)
        throw challengeError(409, "version_conflict", {
          current: {
            minutes: row.minutes,
            version: row.version,
            updatedAt: row.updatedAt,
            updateSource: row.updateSource,
          },
        });
      const [updated] = await tx
        .update(activityChallengeWeek)
        .set({
          minutes: p.minutes,
          version: row.version + 1,
          updatedAt: now,
          updatedBy: p.actorId,
          updateSource: p.source,
        })
        .where(eq(activityChallengeWeek.id, row.id))
        .returning();
      await tx.insert(activityChallengeWeekAudit).values({
        weekId: row.id,
        actorUserId: p.actorId,
        oldMinutes: row.minutes,
        newMinutes: p.minutes,
        oldVersion: row.version,
        newVersion: updated.version,
        source: p.source,
        reason: p.reason,
        createdAt: now,
      });
      return updated;
    });
  }

  // --- Group --------------------------------------------------------------

  private async weekStandings(c: Challenge, weekNumber: number, viewerUserId: string | null) {
    const timing = this.timing(c);
    const rules = this.rules(c);
    const w = timing.weeks[weekNumber - 1];
    const members = await this.activeMembers(c.id);
    const rows = await this.weeksFor(members.map((m) => m.id));
    const byMember = new Map<string, WeekRow[]>();
    for (const r of rows) byMember.set(r.memberId, [...(byMember.get(r.memberId) ?? []), r]);

    const entries = members.map((m) => {
      const mine = byMember.get(m.id) ?? [];
      const row = mine.find((r) => r.weekNumber === weekNumber);
      const minutes = row?.minutes ?? null;
      const result = weekResult(minutes, rules);
      const summary = summarise(this.minutesByWeek(c, mine), rules);
      return {
        memberId: m.id,
        displayName: m.displayName,
        minutes,
        level: result?.level ?? null,
        medal: result?.medal ?? null,
        reachedBaseline: result?.reachedBaseline ?? false,
        updateSource: row?.updateSource ?? null,
        successfulWeeks: summary.successfulWeeks,
        // Whole-challenge total for the overall leaderboard.
        totalMinutes: summary.totalMinutes,
        isMe: m.userId === viewerUserId,
        rank: null as number | null,
        overallRank: null as number | null,
      };
    });

    // Overall: by challenge total. Assigned before the weekly sort below,
    // which fixes the display order.
    assignRanks(entries, (e) => e.totalMinutes, (e, r) => (e.overallRank = r));
    // Weekly: entered totals by minutes desc (names only stabilise display
    // order), then "Not entered" — unranked. Ties share a rank (1, 1, 3).
    assignRanks(entries, (e) => e.minutes, (e, r) => (e.rank = r));

    const entered = entries.filter((e) => e.minutes !== null);
    const levelCounts: Record<string, number> = {};
    for (const rung of rules.ladder) levelCounts[rung.level] = 0;
    for (const e of entered) levelCounts[e.level!]++;
    return {
      week: w,
      inProgress: w.status === "current",
      aggregates: {
        groupMinutes: entered.reduce((s, e) => s + e.minutes!, 0),
        activeCount: entries.length,
        atBaselineCount: entered.filter((e) => e.reachedBaseline).length,
        enteredCount: entered.length,
        notEnteredCount: entries.length - entered.length,
        levelCounts,
      },
      entries,
    };
  }

  private weekQuery(c: Challenge, v: unknown): number {
    if (v === undefined || v === "") return this.timing(c).defaultWeek;
    try {
      return parseWeek(v, c.weekCount);
    } catch {
      throw challengeError(400, "invalid_week_query");
    }
  }

  async standings(userId: string, challengeId: string, weekQuery: unknown) {
    const { challenge } = await this.requireViewer(userId, challengeId);
    return {
      ...(await this.weekStandings(challenge, this.weekQuery(challenge, weekQuery), userId)),
      timing: this.timing(challenge),
    };
  }

  // --- Organiser ----------------------------------------------------------

  async manage(userId: string, challengeId: string) {
    const { challenge: c } = await this.requireOwner(userId, challengeId);
    const rules = this.rules(c);
    const members = await db
      .select()
      .from(activityChallengeMember)
      .where(eq(activityChallengeMember.challengeId, c.id))
      .orderBy(asc(activityChallengeMember.joinedAt));
    const rows = await this.weeksFor(members.map((m) => m.id));
    return {
      ...this.config(c),
      joinToken: c.joinToken,
      invitationUrl: challengeInviteUrl(c.joinToken),
      finalEditCutoff: c.finalEditCutoff,
      timing: this.timing(c),
      members: members.map((m) => {
        const mine = rows.filter((r) => r.memberId === m.id);
        const updated = mine
          .map((r) => r.updatedAt)
          .filter((d): d is Date => !!d)
          .sort((a, b) => b.getTime() - a.getTime());
        return {
          memberId: m.id,
          displayName: m.displayName,
          joinedAt: m.joinedAt,
          removedAt: m.removedAt,
          lastUpdatedAt: updated[0] ?? null,
          weeks: mine.map((r) => ({
            weekNumber: r.weekNumber,
            minutes: r.minutes,
            version: r.version,
            updatedAt: r.updatedAt,
            updateSource: r.updateSource,
            level: weekResult(r.minutes, rules)?.level ?? null,
          })),
          summary: summarise(this.minutesByWeek(c, mine), rules),
        };
      }),
    };
  }

  async updateSettings(userId: string, challengeId: string, body: unknown) {
    const input = parseBody(body, ["joiningClosed", "participantEditingLocked"]);
    await this.requireOwner(userId, challengeId);
    const patch: Partial<Pick<Challenge, "joiningClosed" | "participantEditingLocked">> = {};
    for (const key of ["joiningClosed", "participantEditingLocked"] as const) {
      if (input[key] === undefined) continue;
      if (typeof input[key] !== "boolean") throw challengeError(400, "invalid_setting", { field: key });
      patch[key] = input[key] as boolean;
    }
    if (!Object.keys(patch).length) throw challengeError(400, "invalid_setting");
    await db
      .update(activityChallenge)
      .set({ ...patch, updatedAt: this.clock.now() })
      .where(eq(activityChallenge.id, challengeId));
    return this.manage(userId, challengeId);
  }

  async rotateInvitation(userId: string, challengeId: string) {
    await this.requireOwner(userId, challengeId);
    await db
      .update(activityChallenge)
      .set({ joinToken: newJoinToken(), updatedAt: this.clock.now() })
      .where(eq(activityChallenge.id, challengeId));
    return this.manage(userId, challengeId);
  }

  private async memberOf(challengeId: string, memberId: string): Promise<Member> {
    if (!isUuid(memberId)) throw challengeError(404, "member_not_found");
    const [m] = await db
      .select()
      .from(activityChallengeMember)
      .where(
        and(
          eq(activityChallengeMember.id, memberId),
          eq(activityChallengeMember.challengeId, challengeId),
        ),
      );
    if (!m) throw challengeError(404, "member_not_found");
    return m;
  }

  async updateMember(userId: string, challengeId: string, memberId: string, body: unknown) {
    const input = parseBody(body, ["removed", "displayName"]);
    const { challenge } = await this.requireOwner(userId, challengeId);
    const m = await this.memberOf(challenge.id, memberId);
    const patch: Partial<Pick<Member, "removedAt" | "displayName">> = {};
    if (input.removed !== undefined) {
      if (typeof input.removed !== "boolean") throw challengeError(400, "invalid_member_update");
      patch.removedAt = input.removed ? (m.removedAt ?? this.clock.now()) : null;
    }
    if (input.displayName !== undefined) patch.displayName = parseDisplayName(input.displayName);
    if (!Object.keys(patch).length) throw challengeError(400, "invalid_member_update");
    await db.update(activityChallengeMember).set(patch).where(eq(activityChallengeMember.id, m.id));
    return this.manage(userId, challengeId);
  }

  /** Audited organiser correction. Allowed after the cutoff and while locked; never for future weeks. */
  async correctMemberWeek(
    userId: string,
    challengeId: string,
    memberId: string,
    weekParam: string,
    body: unknown,
  ) {
    const input = parseBody(body, ["minutes", "expectedVersion", "reason"]);
    const { challenge } = await this.requireOwner(userId, challengeId);
    const m = await this.memberOf(challenge.id, memberId);
    const weekNumber = parseWeek(weekParam, challenge.weekCount);
    const minutes = parseMinutes(input.minutes);
    const expectedVersion = parseVersion(input.expectedVersion);
    const reason = parseReason(input.reason);
    if (this.timing(challenge).weeks[weekNumber - 1].status === "future")
      throw challengeError(409, "week_not_started");
    await this.writeWeek({
      memberId: m.id,
      weekNumber,
      minutes,
      expectedVersion,
      actorId: userId,
      source: "organiser",
      reason,
    });
    return this.manage(userId, challengeId);
  }

  async summary(userId: string, challengeId: string, weekQuery: unknown) {
    const { challenge } = await this.requireOwner(userId, challengeId);
    const s = await this.weekStandings(challenge, this.weekQuery(challenge, weekQuery), null);
    return {
      title: challenge.title,
      timeZone: challenge.timeZone,
      baselineMinutes: this.rules(challenge).baselineMinutes,
      weekNumber: s.week.weekNumber,
      weekCount: challenge.weekCount,
      startDate: s.week.startDate,
      endDate: s.week.endDate,
      inProgress: s.inProgress,
      ...s.aggregates,
    };
  }

  async exportCsv(userId: string, challengeId: string): Promise<string> {
    const { challenge: c } = await this.requireOwner(userId, challengeId);
    const rules = this.rules(c);
    const timing = this.timing(c);
    const members = (await this.activeMembers(c.id)).sort(
      (a, b) => a.displayName.localeCompare(b.displayName) || a.joinedAt.getTime() - b.joinedAt.getTime(),
    );
    const rows = await this.weeksFor(members.map((m) => m.id));
    const lines = [
      ["challenge", "display_name", "week", "start_date", "end_date", "minutes", "level", "medal", "last_updated", "update_source"],
    ];
    for (const m of members) {
      for (const w of timing.weeks) {
        const row = rows.find((r) => r.memberId === m.id && r.weekNumber === w.weekNumber);
        const result = weekResult(row?.minutes ?? null, rules);
        lines.push([
          c.title,
          m.displayName,
          String(w.weekNumber),
          w.startDate,
          w.endDate,
          // Blank = not entered; "0" = an explicit zero.
          row?.minutes === null || row?.minutes === undefined ? "" : String(row.minutes),
          result ? String(result.level) : "",
          result ? result.medal : "",
          row?.updatedAt ? row.updatedAt.toISOString() : "",
          row?.updateSource ?? "",
        ]);
      }
    }
    return lines.map((cols) => cols.map(csvCell).join(",")).join("\r\n") + "\r\n";
  }
}

const collator = new Intl.Collator("en", { sensitivity: "base" });

/**
 * Sorts `items` by value desc (null last, names break ties for display only)
 * and assigns competition ranks — equal values share a rank (1, 1, 3); null
 * values stay unranked.
 */
function assignRanks<T extends { displayName: string }>(
  items: T[],
  value: (t: T) => number | null,
  setRank: (t: T, rank: number | null) => void,
) {
  items.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null)
      return va === vb ? collator.compare(a.displayName, b.displayName) : va === null ? 1 : -1;
    return vb - va || collator.compare(a.displayName, b.displayName);
  });
  let prev: { value: number; rank: number } | null = null;
  items.forEach((t, i) => {
    const v = value(t);
    if (v === null) return setRank(t, null);
    const rank = prev && prev.value === v ? prev.rank : i + 1;
    setRank(t, rank);
    prev = { value: v, rank };
  });
}

/**
 * Quotes a CSV cell and neutralises spreadsheet formula injection: text that
 * starts with = + - @ (or a tab/CR) gets a leading apostrophe.
 */
export function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) || safe !== value ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export type { WeekResult };
