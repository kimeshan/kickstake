import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { createApp } from "../create-app";
import { db, pool } from "../db";
import { activityChallenge, activityChallengeMember, user } from "../db/schema";
import { testOtpStore, testReminderStore } from "../email/email";
import { ChallengeClock } from "./clock";
import { INITIAL_CHALLENGE } from "./config";
import { newJoinToken } from "./challenges.service";
import { ChallengeRemindersService } from "./reminders.service";

// Weekly reminder emails: only people who haven't entered, never twice, and
// organiser-triggered nudges from the dashboard.

type Agent = ReturnType<typeof request.agent>;

const WEEK1_TUE = "2026-09-22T09:00:00Z";
// Week 1's reporting request: Mon 28 Sep, 12:00 SAST.
const WEEK1_DUE = "2026-09-28T10:00:00Z";
const WEEK1_DUE_LATER = "2026-09-28T14:00:00Z";

describe("Challenge reminder emails", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let clock: ChallengeClock;
  let reminders: ChallengeRemindersService;
  let seq = 0;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();
    clock = app.get(ChallengeClock, { strict: false });
    reminders = app.get(ChallengeRemindersService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  beforeEach(() => {
    clock.set(WEEK1_TUE);
    testReminderStore.length = 0;
  });

  async function signIn(label: string) {
    const email = `rem-${label}-${Date.now()}-${seq++}@kickstake.dev`;
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
        slug: `rem-${Date.now()}-${seq++}`,
        organiserId,
        joinToken: newJoinToken(),
      })
      .returning();
    return c;
  }

  const join = (agent: Agent, token: string, displayName: string) =>
    agent.post(`/challenges/invitations/${token}/join`).send({ displayName }).expect(200);

  /** Only this challenge's recipients (the suite shares a database). */
  const sentTo = (emails: string[]) => testReminderStore.filter((m) => emails.includes(m.to));

  it("nudges only the people who haven't entered, once, after the week's due time", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const late = await signIn("late");
    const done = await signIn("done");
    await join(late.agent, c.joinToken, "Late Lerato");
    await join(done.agent, c.joinToken, "Done Dan");
    await done.agent.put(`/challenges/${c.id}/me/weeks/1`).send({ minutes: 200, expectedVersion: 0 }).expect(200);

    // Before the reporting request is due: nothing goes out.
    await reminders.sendDueReminders();
    expect(sentTo([late.email, done.email])).toHaveLength(0);

    clock.set(WEEK1_DUE);
    await reminders.sendDueReminders();
    const sent = sentTo([late.email, done.email]);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(late.email);
    expect(sent[0].subject).toBe("Family Level Up: your Week 1 minutes");
    expect(sent[0].text).toContain("Late Lerato");
    expect(sent[0].text).toContain(`/challenges/${c.id}`);
    // The final cutoff, so they know how long they have.
    expect(sent[0].text).toMatch(/Oct 19/);

    // Running again (every 15 minutes) doesn't email anyone twice.
    testReminderStore.length = 0;
    await reminders.sendDueReminders();
    clock.set(WEEK1_DUE_LATER);
    await reminders.sendDueReminders();
    expect(sentTo([late.email, done.email])).toHaveLength(0);
  });

  it("skips people who opted out, and resumes when they opt back in", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const quiet = await signIn("quiet");
    await join(quiet.agent, c.joinToken, "Quiet Quinn");

    const patched = await quiet.agent
      .patch(`/challenges/${c.id}/me`)
      .send({ remindersOptOut: true })
      .expect(200);
    expect(patched.body.remindersOptOut).toBe(true);
    const detail = await quiet.agent.get(`/challenges/${c.id}`).expect(200);
    expect(detail.body.role.remindersOptOut).toBe(true);

    clock.set(WEEK1_DUE);
    await reminders.sendDueReminders();
    expect(sentTo([quiet.email])).toHaveLength(0);

    // Opting back in lets week 2's reminder through (week 1 was never claimed).
    await quiet.agent.patch(`/challenges/${c.id}/me`).send({ remindersOptOut: false }).expect(200);
    await reminders.sendDueReminders();
    expect(sentTo([quiet.email])).toHaveLength(1);
  });

  it("writes the email in the member's language", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const es = await signIn("es");
    await es.agent
      .post(`/challenges/invitations/${c.joinToken}/join`)
      .set("Cookie", "NEXT_LOCALE=es")
      .send({ displayName: "Elena" })
      .expect(200);

    clock.set(WEEK1_DUE);
    await reminders.sendDueReminders();
    const [mail] = sentTo([es.email]);
    expect(mail.locale).toBe("es");
    expect(mail.subject).toBe("Family Level Up: tus minutos de la semana 1");
    expect(mail.text).toContain("Elena");
  });

  it("lets the organiser nudge specific people from the dashboard, repeatedly", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const a = await signIn("a");
    const b = await signIn("b");
    const entered = await signIn("entered");
    const optedOut = await signIn("out");
    const ja = await join(a.agent, c.joinToken, "Ama");
    const jb = await join(b.agent, c.joinToken, "Bongi");
    const je = await join(entered.agent, c.joinToken, "Entered Ed");
    const jo = await join(optedOut.agent, c.joinToken, "Opted Olu");
    await entered.agent.put(`/challenges/${c.id}/me/weeks/1`).send({ minutes: 150, expectedVersion: 0 }).expect(200);
    await optedOut.agent.patch(`/challenges/${c.id}/me`).send({ remindersOptOut: true }).expect(200);

    const res = await owner.agent
      .post(`/challenges/${c.id}/reminders`)
      .send({
        weekNumber: 1,
        memberIds: [ja.body.memberId, jb.body.memberId, je.body.memberId, jo.body.memberId],
      })
      .expect(200);

    const byMember = Object.fromEntries(
      res.body.outcomes.map((o: { memberId: string; sent: boolean; reason?: string }) => [
        o.memberId,
        o.sent ? "sent" : o.reason,
      ]),
    );
    expect(byMember[ja.body.memberId]).toBe("sent");
    expect(byMember[jb.body.memberId]).toBe("sent");
    expect(byMember[je.body.memberId]).toBe("already_entered");
    expect(byMember[jo.body.memberId]).toBe("opted_out");
    expect(sentTo([a.email, b.email, entered.email, optedOut.email]).map((m) => m.to).sort()).toEqual(
      [a.email, b.email].sort(),
    );

    // The dashboard shows who was reminded and when.
    const row = res.body.manage.members.find((m: { memberId: string }) => m.memberId === ja.body.memberId);
    expect(row.lastReminderAt).toBeTruthy();
    expect(row.remindedWeeks).toEqual([1]);
    expect(row.remindersOptOut).toBe(false);

    // Unlike the automatic job, the organiser can nudge again.
    testReminderStore.length = 0;
    await owner.agent
      .post(`/challenges/${c.id}/reminders`)
      .send({ weekNumber: 1, memberIds: [ja.body.memberId] })
      .expect(200);
    expect(sentTo([a.email])).toHaveLength(1);

    // …and the automatic run still treats them as un-nudged for week 1.
    testReminderStore.length = 0;
    clock.set(WEEK1_DUE);
    await reminders.sendDueReminders();
    expect(sentTo([a.email])).toHaveLength(1);
  });

  it("refuses reminders from non-organisers, for future weeks and after the cutoff", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const member = await signIn("m");
    const j = await join(member.agent, c.joinToken, "Mo");

    await member.agent
      .post(`/challenges/${c.id}/reminders`)
      .send({ weekNumber: 1, memberIds: [j.body.memberId] })
      .expect(403);
    expect(
      (await owner.agent.post(`/challenges/${c.id}/reminders`).send({ weekNumber: 4, memberIds: [j.body.memberId] }).expect(409))
        .body.code,
    ).toBe("week_not_started");
    await owner.agent.post(`/challenges/${c.id}/reminders`).send({ weekNumber: 1, memberIds: [] }).expect(400);
    await owner.agent.post(`/challenges/${c.id}/reminders`).send({ weekNumber: 1, memberIds: ["nope"] }).expect(400);
    await owner.agent
      .post(`/challenges/${c.id}/reminders`)
      .send({ weekNumber: 1, memberIds: [j.body.memberId], sendAs: "x" })
      .expect(400);

    clock.set("2026-10-19T12:00:00Z"); // past the final cutoff
    expect(
      (await owner.agent.post(`/challenges/${c.id}/reminders`).send({ weekNumber: 1, memberIds: [j.body.memberId] }).expect(409))
        .body.code,
    ).toBe("editing_closed");
    // The automatic job stops too — there's nothing left to enter.
    testReminderStore.length = 0;
    await reminders.sendDueReminders();
    expect(sentTo([member.email])).toHaveLength(0);
  });

  it("still nudges before the final week closes, and never after a member is removed", async () => {
    const owner = await signIn("owner");
    const c = await createChallenge(owner.userId);
    const p = await signIn("final");
    const j = await join(p.agent, c.joinToken, "Final Fay");

    // Week 4's reporting request lands on the cutoff, so it goes out earlier.
    clock.set("2026-10-19T04:00:00Z"); // 06:00 SAST, six hours before close
    await reminders.sendDueReminders();
    const mails = sentTo([p.email]);
    expect(mails.length).toBeGreaterThanOrEqual(1);
    expect(mails.some((m) => m.subject.includes("Week 4"))).toBe(true);

    testReminderStore.length = 0;
    await owner.agent.patch(`/challenges/${c.id}/members/${j.body.memberId}`).send({ removed: true }).expect(200);
    await db
      .update(activityChallengeMember)
      .set({ removedAt: new Date() })
      .where(eq(activityChallengeMember.id, j.body.memberId));
    await reminders.sendDueReminders();
    expect(sentTo([p.email])).toHaveLength(0);
  });
});
