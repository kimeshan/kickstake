import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { and, eq } from "drizzle-orm";
import { createApp } from "../create-app";
import { db, pool } from "../db";
import {
  activityChallenge,
  activityChallengeMember,
  activityChallengeWeek,
  activityChallengeWeekAudit,
  user,
} from "../db/schema";
import { testOtpStore } from "../email/email";
import { ChallengeClock } from "./clock";
import { INITIAL_CHALLENGE } from "./config";
import { newJoinToken } from "./challenges.service";

// Full-stack: real email-OTP sessions over HTTP against the real test DB.
// Server time is frozen via ChallengeClock to exercise week boundaries.

type Agent = ReturnType<typeof request.agent>;

const WEEK1 = "2026-09-22T09:00:00Z"; // Tue of week 1
const WEEK3 = "2026-10-06T09:00:00Z"; // Tue of week 3
const REPORTING = "2026-10-19T08:00:00Z"; // Mon after week 4, before noon SAST
const AFTER_CUTOFF = "2026-10-19T10:00:00Z";

describe("Challenges HTTP", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let clock: ChallengeClock;
  let seq = 0;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();
    clock = app.get(ChallengeClock, { strict: false });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(() => clock.set(WEEK1));

  async function signIn(label: string): Promise<{ agent: Agent; userId: string; email: string }> {
    const email = `ch-${label}-${Date.now()}-${seq++}@kickstake.dev`;
    const agent = request.agent(server);
    await agent.post("/auth/email-otp/send-verification-otp").send({ email, type: "sign-in" }).expect(200);
    await agent.post("/auth/sign-in/email-otp").send({ email, otp: testOtpStore.get(email) }).expect(200);
    const [u] = await db.select().from(user).where(eq(user.email, email));
    return { agent, userId: u.id, email };
  }

  async function createChallenge(organiserId: string) {
    const [c] = await db
      .insert(activityChallenge)
      .values({
        ...INITIAL_CHALLENGE,
        slug: `test-${Date.now()}-${seq++}`,
        organiserId,
        joinToken: newJoinToken(),
      })
      .returning();
    return c;
  }

  async function join(agent: Agent, token: string, displayName = "Thandi") {
    const res = await agent.post(`/challenges/invitations/${token}/join`).send({ displayName }).expect(200);
    return res.body as { challengeId: string; memberId: string; created: boolean };
  }

  const save = (agent: Agent, id: string, week: number, minutes: number | null, expectedVersion: number) =>
    agent.put(`/challenges/${id}/me/weeks/${week}`).send({ minutes, expectedVersion });

  it("invitation preview is public and leaks no members, emails or totals", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const member = await signIn("m");
    await join(member.agent, c.joinToken);

    const res = await request(server).get(`/challenges/invitations/${c.joinToken}`).expect(200);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.body).toMatchObject({
      title: "Family Level Up",
      startDate: "2026-09-21",
      lastActivityDate: "2026-10-18",
      weekCount: 4,
      baselineMinutes: 150,
      joinable: true,
      viewer: null,
    });
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(member.email);
    expect(text).not.toContain("Thandi");
    expect(text).not.toContain(owner.userId);
    expect(res.body).not.toHaveProperty("id");

    await request(server).get("/challenges/invitations/nope-nope").expect(404);
    await request(server).get("/challenges/invitations/bad%20token").expect(404);
  });

  it("signed-out visitors can't join or read anything private", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    await request(server).post(`/challenges/invitations/${c.joinToken}/join`).send({ displayName: "X" }).expect(401);
    await request(server).get(`/challenges/${c.id}/standings`).expect(401);
    await request(server).get(`/challenges/${c.id}/manage`).expect(401);
    await request(server).get(`/challenges/${c.id}/export.csv`).expect(401);
  });

  it("join is idempotent and race-safe: one membership, exactly four week rows", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("racer");

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        p.agent.post(`/challenges/invitations/${c.joinToken}/join`).send({ displayName: "  Racer  " }),
      ),
    );
    for (const r of results) expect(r.status).toBe(200);
    expect(results.filter((r) => r.body.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.body.memberId)).size).toBe(1);
    expect(results[0].body.displayName).toBe("Racer");

    const members = await db
      .select()
      .from(activityChallengeMember)
      .where(eq(activityChallengeMember.challengeId, c.id));
    expect(members).toHaveLength(1);
    const weeks = await db
      .select()
      .from(activityChallengeWeek)
      .where(eq(activityChallengeWeek.memberId, members[0].id));
    expect(weeks.map((w) => [w.weekNumber, w.minutes, w.version]).sort()).toEqual([
      [1, null, 0],
      [2, null, 0],
      [3, null, 0],
      [4, null, 0],
    ]);

    // Retry after the fact returns the same membership.
    expect(await join(p.agent, c.joinToken)).toMatchObject({ memberId: members[0].id, created: false });

    // The invitation now routes this viewer straight to their challenge.
    const inv = await p.agent.get(`/challenges/invitations/${c.joinToken}`).expect(200);
    expect(inv.body.viewer).toEqual({ status: "member", challengeId: c.id });
  });

  it("two accounts with the same display name stay independent", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const a = await signIn("a");
    const b = await signIn("b");
    const ja = await join(a.agent, c.joinToken, "Sam");
    const jb = await join(b.agent, c.joinToken, "Sam");
    expect(ja.memberId).not.toBe(jb.memberId);
    await save(a.agent, c.id, 1, 300, 0).expect(200);
    const bMe = await b.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(bMe.body.weeks[0].minutes).toBeNull();
  });

  it("validates display names", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("v");
    for (const displayName of ["", "   ", "x".repeat(51), 42, null]) {
      const r = await p.agent.post(`/challenges/invitations/${c.joinToken}/join`).send({ displayName }).expect(400);
      expect(r.body.code).toBe("invalid_display_name");
    }
    const r = await p.agent
      .post(`/challenges/invitations/${c.joinToken}/join`)
      .send({ displayName: "Ok", userId: "someone-else" })
      .expect(400);
    expect(r.body).toMatchObject({ code: "unknown_field", field: "userId" });
    // 50 chars (incl. multi-byte) is fine.
    await join(p.agent, c.joinToken, "é".repeat(50));
  });

  it("saving replaces, never adds; retries can't double-count", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("saver");
    await join(p.agent, c.joinToken);

    const first = await save(p.agent, c.id, 1, 150, 0).expect(200);
    expect(first.headers["cache-control"]).toBe("private, no-store");
    expect(first.body.weeks[0]).toMatchObject({ minutes: 150, version: 1, updateSource: "participant", inProgress: true });
    expect(first.body.weeks[0].result).toMatchObject({ level: 1, medal: "bronze", minutesToNext: 50 });

    const second = await save(p.agent, c.id, 1, 200, 1).expect(200);
    expect(second.body.weeks[0]).toMatchObject({ minutes: 200, version: 2 });
    expect(second.body.summary).toMatchObject({ totalMinutes: 200, bestWeek: 200, successfulWeeks: 1 });

    // A replayed request (double tap / network retry) is stale → 409, no change.
    const replay = await save(p.agent, c.id, 1, 200, 1).expect(409);
    expect(replay.body).toMatchObject({ code: "version_conflict", current: { minutes: 200, version: 2 } });
    expect(replay.headers["cache-control"]).toBe("private, no-store");

    const reread = await p.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(reread.body.weeks[0]).toMatchObject({ minutes: 200, version: 2 });
    expect(reread.body.summary.totalMinutes).toBe(200);
  });

  it("rejects invalid minutes and unknown fields; distinguishes 0 from not entered; clear restores null", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("inv");
    const { memberId } = await join(p.agent, c.joinToken);

    for (const minutes of [1.5, -1, "180", 10081, true, undefined, {}]) {
      const r = await p.agent.put(`/challenges/${c.id}/me/weeks/1`).send({ minutes, expectedVersion: 0 }).expect(400);
      expect(r.body.code).toBe("invalid_minutes");
    }
    for (const extra of [{ level: 11 }, { userId: "x" }, { role: "owner" }, { memberId }]) {
      const r = await p.agent.put(`/challenges/${c.id}/me/weeks/1`).send({ minutes: 10, expectedVersion: 0, ...extra }).expect(400);
      expect(r.body.code).toBe("unknown_field");
    }
    for (const week of ["0", "5", "abc", "1.5", "-1"]) {
      const r = await save(p.agent, c.id, week as unknown as number, 10, 0).expect(400);
      expect(r.body.code).toBe("invalid_week");
    }
    await p.agent.put(`/challenges/${c.id}/me/weeks/1`).send({ minutes: 10, expectedVersion: -1 }).expect(400);

    // Upper bound is allowed (the >1,000 confirmation is a client concern).
    await save(p.agent, c.id, 1, 10080, 0).expect(200);

    const zero = await save(p.agent, c.id, 1, 0, 1).expect(200);
    expect(zero.body.weeks[0]).toMatchObject({ minutes: 0, result: { level: 0, medal: "none" } });
    expect(zero.body.summary).toMatchObject({ totalMinutes: 0, enteredWeeks: 1 });

    const cleared = await save(p.agent, c.id, 1, null, 2).expect(200);
    expect(cleared.body.weeks[0]).toMatchObject({ minutes: null, version: 3, result: null });
    expect(cleared.body.summary).toMatchObject({ totalMinutes: null, enteredWeeks: 0 });

    const [row] = await db
      .select()
      .from(activityChallengeWeek)
      .where(and(eq(activityChallengeWeek.memberId, memberId), eq(activityChallengeWeek.weekNumber, 1)));
    const audit = await db
      .select()
      .from(activityChallengeWeekAudit)
      .where(eq(activityChallengeWeekAudit.weekId, row.id));
    expect(audit.map((a) => [a.oldMinutes, a.newMinutes, a.oldVersion, a.newVersion]).sort((x, y) => x[2]! - y[2]!)).toEqual([
      [null, 10080, 0, 1],
      [10080, 0, 1, 2],
      [0, null, 2, 3],
    ]);
  });

  it("two clients on the same version: one wins, the other gets a conflict", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("dual");
    await join(p.agent, c.joinToken);
    const [r1, r2] = await Promise.all([save(p.agent, c.id, 1, 180, 0), save(p.agent, c.id, 1, 240, 0)]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = r1.status === 409 ? r1 : r2;
    const winner = r1.status === 200 ? r1 : r2;
    expect(loser.body.current.minutes).toBe(winner.body.weeks[0].minutes);
  });

  it("enforces the calendar: future weeks read-only, backfill until the final cutoff", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("cal");

    // Before the start: can join, nothing is editable yet.
    clock.set("2026-09-20T21:59:00Z");
    await join(p.agent, c.joinToken);
    const before = await p.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(before.body.timing.phase).toBe("upcoming");
    expect(before.body.weeks.every((w: { editable: boolean }) => !w.editable)).toBe(true);
    expect((await save(p.agent, c.id, 1, 10, 0).expect(409)).body.code).toBe("week_not_started");

    // Local Monday 00:00 SAST opens week 1.
    clock.set("2026-09-20T22:00:00Z");
    await save(p.agent, c.id, 1, 10, 0).expect(200);
    expect((await save(p.agent, c.id, 2, 10, 0).expect(409)).body.code).toBe("week_not_started");

    // Soft deadlines don't lock: week 1 is still correctable in week 3.
    clock.set(WEEK3);
    await save(p.agent, c.id, 1, 160, 1).expect(200);
    await save(p.agent, c.id, 2, 170, 0).expect(200);
    await save(p.agent, c.id, 3, 20, 0).expect(200);
    expect((await save(p.agent, c.id, 4, 10, 0).expect(409)).body.code).toBe("week_not_started");

    // Reporting window after activity ends.
    clock.set(REPORTING);
    const rep = await save(p.agent, c.id, 4, 200, 0).expect(200);
    expect(rep.body.timing.phase).toBe("reporting");
    expect(rep.body.summary).toMatchObject({ successfulWeeks: 3, bestStreak: 2, totalMinutes: 550 });

    // Final cutoff — participant edits close, joining ends.
    clock.set(AFTER_CUTOFF);
    expect((await save(p.agent, c.id, 4, 250, 1).expect(409)).body.code).toBe("editing_closed");
    const after = await p.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(after.body.timing.phase).toBe("finished");
    expect(after.body.weeks.every((w: { editable: boolean }) => !w.editable)).toBe(true);
    const late = await signIn("late");
    const r = await late.agent.post(`/challenges/invitations/${c.joinToken}/join`).send({ displayName: "Late" }).expect(409);
    expect(r.body.code).toBe("challenge_ended");
    const inv = await request(server).get(`/challenges/invitations/${c.joinToken}`).expect(200);
    expect(inv.body).toMatchObject({ joinable: false, unavailableReason: "challenge_ended" });
  });

  it("late joiners can backfill elapsed weeks", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    clock.set(WEEK3);
    const p = await signIn("late");
    await join(p.agent, c.joinToken);
    const me = await p.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(me.body.weeks.map((w: { status: string; editable: boolean }) => [w.status, w.editable])).toEqual([
      ["elapsed", true],
      ["elapsed", true],
      ["current", true],
      ["future", false],
    ]);
    await save(p.agent, c.id, 1, 150, 0).expect(200);
  });

  it("scopes access: non-members, other participants and wrong-challenge IDs are refused", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const other = await createChallenge(owner.userId);
    const a = await signIn("a");
    const b = await signIn("b");
    const outsider = await signIn("out");
    const ja = await join(a.agent, c.joinToken, "A");
    await join(b.agent, c.joinToken, "B");
    const jOther = await join(a.agent, other.joinToken, "A2");

    for (const path of ["", "/me", "/standings"]) {
      const r = await outsider.agent.get(`/challenges/${c.id}${path}`).expect(403);
      expect(r.body.code).toBe("not_a_member");
    }
    // Members can't reach organiser endpoints or write someone else's week.
    await b.agent.get(`/challenges/${c.id}/manage`).expect(403);
    await b.agent.get(`/challenges/${c.id}/export.csv`).expect(403);
    await b.agent.get(`/challenges/${c.id}/summary`).expect(403);
    await b.agent.patch(`/challenges/${c.id}/settings`).send({ participantEditingLocked: true }).expect(403);
    await b.agent.post(`/challenges/${c.id}/invitation/rotate`).expect(403);
    await b.agent
      .put(`/challenges/${c.id}/members/${ja.memberId}/weeks/1`)
      .send({ minutes: 1, expectedVersion: 0, reason: "hax" })
      .expect(403);
    const aMe = await a.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(aMe.body.weeks[0].minutes).toBeNull();

    // Owner can't reach a member through the wrong challenge.
    const wrong = await owner.agent
      .put(`/challenges/${c.id}/members/${jOther.memberId}/weeks/1`)
      .send({ minutes: 1, expectedVersion: 0, reason: "x" })
      .expect(404);
    expect(wrong.body.code).toBe("member_not_found");
    await owner.agent.patch(`/challenges/${c.id}/members/not-a-uuid`).send({ removed: true }).expect(404);
    await owner.agent.get(`/challenges/00000000-0000-0000-0000-000000000000`).expect(404);
    await owner.agent.get(`/challenges/garbage`).expect(404);

    // The organiser isn't automatically a participant.
    const d = await owner.agent.get(`/challenges/${c.id}`).expect(200);
    expect(d.body.role).toEqual({ isOwner: true, isMember: false, memberId: null, displayName: null });
    expect((await owner.agent.get(`/challenges/${c.id}/me`).expect(403)).body.code).toBe("not_a_member");
    await owner.agent.get(`/challenges/${c.id}/standings`).expect(200);

    // /mine lists own memberships and owned challenges only.
    const mine = await a.agent.get("/challenges/mine").expect(200);
    expect(mine.body.challenges.map((x: { id: string }) => x.id).sort()).toEqual([c.id, other.id].sort());
    expect((await outsider.agent.get("/challenges/mine").expect(200)).body.challenges).toEqual([]);
  });

  it("removed members lose access immediately and can't rejoin until restored", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("rm");
    const { memberId } = await join(p.agent, c.joinToken, "Removed Rita");
    await save(p.agent, c.id, 1, 300, 0).expect(200);

    await owner.agent.patch(`/challenges/${c.id}/members/${memberId}`).send({ removed: true }).expect(200);
    for (const path of ["", "/me", "/standings"]) {
      const r = await p.agent.get(`/challenges/${c.id}${path}`).expect(403);
      expect(r.body.code).toBe("membership_removed");
    }
    expect((await save(p.agent, c.id, 1, 1, 1).expect(403)).body.code).toBe("membership_removed");
    expect(
      (await p.agent.post(`/challenges/invitations/${c.joinToken}/join`).send({ displayName: "Again" }).expect(403)).body.code,
    ).toBe("membership_removed");
    // Even with a rotated (new) token.
    const rotated = await owner.agent.post(`/challenges/${c.id}/invitation/rotate`).expect(200);
    await p.agent
      .post(`/challenges/invitations/${rotated.body.joinToken}/join`)
      .send({ displayName: "Again" })
      .expect(403);

    // Excluded from group results.
    const st = await owner.agent.get(`/challenges/${c.id}/standings?week=1`).expect(200);
    expect(st.body.entries).toHaveLength(0);
    expect(st.body.aggregates.groupMinutes).toBe(0);

    // Restore keeps history.
    await owner.agent.patch(`/challenges/${c.id}/members/${memberId}`).send({ removed: false }).expect(200);
    const me = await p.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(me.body.weeks[0].minutes).toBe(300);
  });

  it("organiser corrections: audited, allowed after cutoff and while locked; lock blocks participants", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("corr");
    const { memberId } = await join(p.agent, c.joinToken, "Corrected");

    await owner.agent.patch(`/challenges/${c.id}/settings`).send({ participantEditingLocked: true }).expect(200);
    expect((await save(p.agent, c.id, 1, 100, 0).expect(409)).body.code).toBe("editing_locked");

    const noReason = await owner.agent
      .put(`/challenges/${c.id}/members/${memberId}/weeks/1`)
      .send({ minutes: 100, expectedVersion: 0, reason: "   " })
      .expect(400);
    expect(noReason.body.code).toBe("reason_required");
    const future = await owner.agent
      .put(`/challenges/${c.id}/members/${memberId}/weeks/2`)
      .send({ minutes: 100, expectedVersion: 0, reason: "early" })
      .expect(409);
    expect(future.body.code).toBe("week_not_started");

    await owner.agent
      .put(`/challenges/${c.id}/members/${memberId}/weeks/1`)
      .send({ minutes: 100, expectedVersion: 0, reason: "Told me on WhatsApp" })
      .expect(200);

    // Unlock doesn't override the final cutoff.
    await owner.agent.patch(`/challenges/${c.id}/settings`).send({ participantEditingLocked: false }).expect(200);
    clock.set(AFTER_CUTOFF);
    expect((await save(p.agent, c.id, 1, 120, 1).expect(409)).body.code).toBe("editing_closed");

    const fixed = await owner.agent
      .put(`/challenges/${c.id}/members/${memberId}/weeks/4`)
      .send({ minutes: 450, expectedVersion: 0, reason: "Late report" })
      .expect(200);
    const row = fixed.body.members.find((m: { memberId: string }) => m.memberId === memberId);
    expect(row.weeks[3]).toMatchObject({ minutes: 450, updateSource: "organiser", level: 7 });
    expect(row.summary.totalMinutes).toBe(550);

    const me = await p.agent.get(`/challenges/${c.id}/me`).expect(200);
    expect(me.body.weeks[0]).toMatchObject({ minutes: 100, updateSource: "organiser" });

    const [wk] = await db
      .select()
      .from(activityChallengeWeek)
      .where(and(eq(activityChallengeWeek.memberId, memberId), eq(activityChallengeWeek.weekNumber, 4)));
    const [audit] = await db.select().from(activityChallengeWeekAudit).where(eq(activityChallengeWeekAudit.weekId, wk.id));
    expect(audit).toMatchObject({ actorUserId: owner.userId, source: "organiser", reason: "Late report", newMinutes: 450 });

    const st = await owner.agent.get(`/challenges/${c.id}/standings?week=4`).expect(200);
    expect(st.body.aggregates).toMatchObject({ groupMinutes: 450, atBaselineCount: 1 });

    const bad = await owner.agent.patch(`/challenges/${c.id}/settings`).send({ organiserId: "x" }).expect(400);
    expect(bad.body.code).toBe("unknown_field");
    await owner.agent.patch(`/challenges/${c.id}/settings`).send({ joiningClosed: "yes" }).expect(400);
  });

  it("standings rank ties together, leave missing entries unranked and keep zeros", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const people = [];
    for (let i = 0; i < 5; i++) people.push(await signIn(`rank${i}`));
    const names = ["Zed", "amy", "Bo", "Cy", "Di"];
    for (let i = 0; i < people.length; i++) await join(people[i].agent, c.joinToken, names[i]);
    await save(people[0].agent, c.id, 1, 200, 0).expect(200); // Zed
    await save(people[1].agent, c.id, 1, 200, 0).expect(200); // amy
    await save(people[2].agent, c.id, 1, 150, 0).expect(200); // Bo
    await save(people[3].agent, c.id, 1, 0, 0).expect(200); // Cy — explicit zero
    // Di — not entered

    const st = await people[2].agent.get(`/challenges/${c.id}/standings`).expect(200);
    expect(st.body.week.weekNumber).toBe(1);
    expect(st.body.inProgress).toBe(true);
    expect(st.body.entries.map((e: { displayName: string; minutes: number | null; rank: number | null }) => [e.displayName, e.minutes, e.rank])).toEqual([
      ["amy", 200, 1],
      ["Zed", 200, 1],
      ["Bo", 150, 3],
      ["Cy", 0, 4],
      ["Di", null, null],
    ]);
    expect(st.body.entries.find((e: { isMe: boolean }) => e.isMe).displayName).toBe("Bo");
    expect(st.body.aggregates).toMatchObject({
      groupMinutes: 550,
      activeCount: 5,
      atBaselineCount: 3,
      notEnteredCount: 1,
      enteredCount: 4,
    });
    expect(st.body.aggregates.levelCounts).toMatchObject({ 0: 1, 1: 1, 2: 2 });
    expect(JSON.stringify(st.body)).not.toMatch(/@kickstake\.dev/);

    await people[0].agent.get(`/challenges/${c.id}/standings?week=9`).expect(400);

    const summary = await owner.agent.get(`/challenges/${c.id}/summary?week=1`).expect(200);
    expect(summary.body).toMatchObject({
      weekNumber: 1,
      startDate: "2026-09-21",
      endDate: "2026-09-27",
      groupMinutes: 550,
      atBaselineCount: 3,
      activeCount: 5,
      notEnteredCount: 1,
      inProgress: true,
    });
  });

  it("overall leaderboard ranks challenge totals independently of the week", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    clock.set(WEEK3);
    const a = await signIn("ova");
    const b = await signIn("ovb");
    const n = await signIn("ovn");
    await join(a.agent, c.joinToken, "Ace");
    await join(b.agent, c.joinToken, "Bee");
    await join(n.agent, c.joinToken, "Nil");
    await save(a.agent, c.id, 1, 300, 0).expect(200); // Ace: 300 total, nothing in week 3
    await save(b.agent, c.id, 1, 100, 0).expect(200);
    await save(b.agent, c.id, 2, 100, 0).expect(200);
    await save(b.agent, c.id, 3, 150, 0).expect(200); // Bee: 350 total

    const st = await a.agent.get(`/challenges/${c.id}/standings?week=3`).expect(200);
    const rows = Object.fromEntries(
      st.body.entries.map((e: { displayName: string; minutes: number | null; rank: number | null; totalMinutes: number | null; overallRank: number | null }) => [
        e.displayName,
        { week: [e.minutes, e.rank], overall: [e.totalMinutes, e.overallRank] },
      ]),
    );
    expect(rows).toEqual({
      Bee: { week: [150, 1], overall: [350, 1] },
      Ace: { week: [null, null], overall: [300, 2] },
      Nil: { week: [null, null], overall: [null, null] },
    });
    // Display order follows the weekly ranking.
    expect(st.body.entries.map((e: { displayName: string }) => e.displayName)).toEqual(["Bee", "Ace", "Nil"]);
  });

  it("CSV export preserves blank vs zero, excludes emails/tokens, neutralises formulas", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const a = await signIn("csv-a");
    const b = await signIn("csv-b");
    await join(a.agent, c.joinToken, "=SUM(A1:A9)");
    await join(b.agent, c.joinToken, "Zero Zola");
    await save(a.agent, c.id, 1, 240, 0).expect(200);
    await save(b.agent, c.id, 1, 0, 0).expect(200);

    const res = await owner.agent.get(`/challenges/${c.id}/export.csv`).expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/csv/);
    expect(res.headers["cache-control"]).toBe("private, no-store");
    const lines = res.text.trim().split("\r\n");
    expect(lines[0]).toBe("challenge,display_name,week,start_date,end_date,minutes,level,medal,last_updated,update_source");
    expect(lines).toHaveLength(1 + 2 * 4);
    expect(lines[1]).toMatch(/^Family Level Up,"'=SUM\(A1:A9\)",1,2026-09-21,2026-09-27,240,2,bronze,2026-09-22T09:00:00.000Z,participant$/);
    expect(lines[2]).toBe(`Family Level Up,"'=SUM(A1:A9)",2,2026-09-28,2026-10-04,,,,,`);
    expect(lines[5]).toMatch(/^Family Level Up,Zero Zola,1,2026-09-21,2026-09-27,0,0,none,/);
    expect(res.text).not.toContain("@kickstake.dev");
    expect(res.text).not.toContain(c.joinToken);
  });

  it("joining closed stops newcomers, not existing members; rotation keeps memberships", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("early");
    const { memberId } = await join(p.agent, c.joinToken);

    await owner.agent.patch(`/challenges/${c.id}/settings`).send({ joiningClosed: true }).expect(200);
    const newcomer = await signIn("new");
    const r = await newcomer.agent.post(`/challenges/invitations/${c.joinToken}/join`).send({ displayName: "N" }).expect(409);
    expect(r.body.code).toBe("joining_closed");
    expect((await request(server).get(`/challenges/invitations/${c.joinToken}`)).body).toMatchObject({
      joinable: false,
      unavailableReason: "joining_closed",
    });
    expect(await join(p.agent, c.joinToken)).toMatchObject({ memberId, created: false });

    await owner.agent.patch(`/challenges/${c.id}/settings`).send({ joiningClosed: false }).expect(200);
    const rotated = await owner.agent.post(`/challenges/${c.id}/invitation/rotate`).expect(200);
    expect(rotated.body.joinToken).not.toBe(c.joinToken);
    expect(rotated.body.invitationUrl).toMatch(new RegExp(`/challenges/join/${rotated.body.joinToken}$`));
    await request(server).get(`/challenges/invitations/${c.joinToken}`).expect(404);
    await join(newcomer.agent, rotated.body.joinToken, "N");
    await p.agent.get(`/challenges/${c.id}/me`).expect(200);
  });

  it("members can rename themselves without touching the account name", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("rename");
    await join(p.agent, c.joinToken, "Old");
    const r = await p.agent.patch(`/challenges/${c.id}/me`).send({ displayName: " New Name " }).expect(200);
    expect(r.body.displayName).toBe("New Name");
    await p.agent.patch(`/challenges/${c.id}/me`).send({ displayName: "x", role: "owner" }).expect(400);
    const [u] = await db.select().from(user).where(eq(user.id, p.userId));
    expect(u.name).not.toBe("New Name");
  });

  it("rejects mutations from untrusted origins", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("origin");
    const evil = await p.agent
      .post(`/challenges/invitations/${c.joinToken}/join`)
      .set("Origin", "https://evil.kickstake.app")
      .send({ displayName: "X" })
      .expect(403);
    expect(evil.body.code).toBe("untrusted_origin");
    await p.agent
      .post(`/challenges/invitations/${c.joinToken}/join`)
      .set("Sec-Fetch-Site", "cross-site")
      .send({ displayName: "X" })
      .expect(403);
    await p.agent
      .post(`/challenges/invitations/${c.joinToken}/join`)
      .set("Origin", "http://localhost:3800")
      .send({ displayName: "X" })
      .expect(200);
  });
});
