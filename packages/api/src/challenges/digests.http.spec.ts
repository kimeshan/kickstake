import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { createApp } from "../create-app";
import { db, pool } from "../db";
import { activityChallenge, user } from "../db/schema";
import { testDigestStore, testOtpStore } from "../email/email";
import { ChallengeClock } from "./clock";
import { INITIAL_CHALLENGE } from "./config";
import { newJoinToken } from "./challenges.service";
import { ChallengeDigestsService } from "./digests.service";

// Leaderboard digests: schedule (Wed + Sun 18:00 local, at most twice a
// week), opt-out, idempotency, and the organiser's "send now".

type Agent = ReturnType<typeof request.agent>;

// Week 1 of the fixture challenge runs Mon 21 – Sun 27 Sep 2026 (SAST).
const WED_18_SAST = "2026-09-23T16:00:00Z";
const WED_19_SAST = "2026-09-23T17:00:00Z";
const SUN_18_SAST = "2026-09-27T16:00:00Z";
const THU_18_SAST = "2026-09-24T16:00:00Z";
const MON_18_SAST = "2026-09-21T16:00:00Z";

describe("Challenge leaderboard digests", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let clock: ChallengeClock;
  let digests: ChallengeDigestsService;
  let seq = 0;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();
    clock = app.get(ChallengeClock, { strict: false });
    digests = app.get(ChallengeDigestsService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(() => {
    clock.set(WED_18_SAST);
    testDigestStore.length = 0;
  });

  async function signIn(label: string) {
    const email = `dig-${label}-${Date.now()}-${seq++}@kickstake.dev`;
    const agent = request.agent(server);
    await agent.post("/auth/email-otp/send-verification-otp").send({ email, type: "sign-in" }).expect(200);
    await agent.post("/auth/sign-in/email-otp").send({ email, otp: testOtpStore.get(email) }).expect(200);
    const [u] = await db.select().from(user).where(eq(user.email, email));
    return { agent, userId: u.id, email };
  }

  async function createChallenge(organiserId: string, cadence: "off" | "weekly" | "twice_weekly" = "twice_weekly") {
    const [c] = await db
      .insert(activityChallenge)
      .values({
        ...INITIAL_CHALLENGE,
        slug: `dig-${Date.now()}-${seq++}`,
        organiserId,
        joinToken: newJoinToken(),
        digestCadence: cadence,
      })
      .returning();
    return c;
  }

  const join = (agent: Agent, token: string, displayName: string) =>
    agent.post(`/challenges/invitations/${token}/join`).send({ displayName }).expect(200);

  const sentTo = (emails: string[]) => testDigestStore.filter((m) => emails.includes(m.to));

  it("sends on Wednesday and Sunday evenings — at most twice a week — and never twice per slot", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const a = await signIn("a");
    const b = await signIn("b");
    await join(a.agent, c.joinToken, "Ama");
    await join(b.agent, c.joinToken, "Bo");
    await a.agent.put(`/challenges/${c.id}/me/weeks/1`).send({ minutes: 300, expectedVersion: 0 }).expect(200);
    const mine = [a.email, b.email];

    // Wednesday 18:00 local.
    await digests.sendDueDigests();
    expect(sentTo(mine)).toHaveLength(2);
    const toAma = sentTo([a.email])[0];
    expect(toAma.subject).toBe("Family Level Up — Week 1 leaderboard");
    expect(toAma.text).toContain("You're #1 this week with 300 minutes.");
    expect(toAma.text).toContain("Ama");
    expect(toAma.text).toContain("Bo");
    // The person with nothing entered is told so, not given a fake rank.
    expect(sentTo([b.email])[0].text).toContain("You haven't added your minutes for this week yet.");

    // Later the same evening (the job runs every 15 minutes): no repeats.
    testDigestStore.length = 0;
    clock.set(WED_19_SAST);
    await digests.sendDueDigests();
    expect(sentTo(mine)).toHaveLength(0);

    // Thursday: not a send day.
    clock.set(THU_18_SAST);
    await digests.sendDueDigests();
    expect(sentTo(mine)).toHaveLength(0);

    // Sunday: the second (and last) send of the week.
    clock.set(SUN_18_SAST);
    await digests.sendDueDigests();
    expect(sentTo(mine)).toHaveLength(2);

    // Monday is reminder day — no digest, so nobody gets two emails at once.
    testDigestStore.length = 0;
    clock.set(MON_18_SAST);
    await digests.sendDueDigests();
    expect(sentTo(mine)).toHaveLength(0);
  });

  it("weekly cadence sends only on Sunday; 'off' sends nothing", async () => {
    const owner = await signIn("owner");
    const weekly = await createChallenge(owner.userId, "weekly");
    const off = await createChallenge(owner.userId, "off");
    const w = await signIn("w");
    const o = await signIn("o");
    await join(w.agent, weekly.joinToken, "Weekly Wes");
    await join(o.agent, off.joinToken, "Off Ope");

    await digests.sendDueDigests(); // Wednesday
    expect(sentTo([w.email, o.email])).toHaveLength(0);

    clock.set(SUN_18_SAST);
    await digests.sendDueDigests();
    expect(sentTo([w.email]).length).toBe(1);
    expect(sentTo([o.email])).toHaveLength(0);
  });

  it("respects the per-person opt-out, independently of reminder emails", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const quiet = await signIn("quiet");
    await join(quiet.agent, c.joinToken, "Quiet Quinn");

    const patched = await quiet.agent
      .patch(`/challenges/${c.id}/me`)
      .send({ digestOptOut: true })
      .expect(200);
    expect(patched.body).toMatchObject({ digestOptOut: true, remindersOptOut: false });

    await digests.sendDueDigests();
    expect(sentTo([quiet.email])).toHaveLength(0);

    await quiet.agent.patch(`/challenges/${c.id}/me`).send({ digestOptOut: false }).expect(200);
    clock.set(SUN_18_SAST);
    await digests.sendDueDigests();
    expect(sentTo([quiet.email])).toHaveLength(1);
  });

  it("lets the organiser change the cadence and send the leaderboard now", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("p");
    await join(p.agent, c.joinToken, "Pat");

    const settings = await owner.agent
      .patch(`/challenges/${c.id}/settings`)
      .send({ digestCadence: "weekly" })
      .expect(200);
    expect(settings.body.digestCadence).toBe("weekly");
    await owner.agent.patch(`/challenges/${c.id}/settings`).send({ digestCadence: "daily" }).expect(400);

    // "Send now" ignores the schedule and can be repeated.
    const res = await owner.agent.post(`/challenges/${c.id}/digest`).expect(200);
    expect(res.body.outcomes.filter((o: { sent: boolean }) => o.sent)).toHaveLength(1);
    expect(res.body.manage.lastDigestAt).toBeTruthy();
    expect(sentTo([p.email])).toHaveLength(1);
    await owner.agent.post(`/challenges/${c.id}/digest`).expect(200);
    expect(sentTo([p.email])).toHaveLength(2);

    // …and it doesn't consume the scheduled slot.
    testDigestStore.length = 0;
    clock.set(SUN_18_SAST);
    await digests.sendDueDigests();
    expect(sentTo([p.email])).toHaveLength(1);

    // Participants can't send it.
    await p.agent.post(`/challenges/${c.id}/digest`).expect(403);
  });

  it("doesn't send before the challenge starts or after entries close", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("p");
    await join(p.agent, c.joinToken, "Pat");

    clock.set("2026-09-16T16:00:00Z"); // Wednesday before the start
    await digests.sendDueDigests();
    expect(sentTo([p.email])).toHaveLength(0);
    await owner.agent.post(`/challenges/${c.id}/digest`).expect(409);

    clock.set("2026-10-21T16:00:00Z"); // Wednesday after the final cutoff
    await digests.sendDueDigests();
    expect(sentTo([p.email])).toHaveLength(0);
  });
});
