import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { createApp } from "../create-app";
import { db, pool } from "../db";
import { tournament } from "../db/schema";
import { testOtpStore } from "../email/email";

// Full-stack integration: real better-auth email-OTP sign-in over HTTP, then
// the auth-guarded sweepstake endpoints. Exercises the same app main.ts boots.
describe("Sweepstakes HTTP (auth + endpoints)", () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication["getHttpServer"]>;
  let tournamentId: string;

  beforeAll(async () => {
    app = await createApp();
    await app.init();
    server = app.getHttpServer();
    const [t] = await db
      .insert(tournament)
      .values({ name: "HTTP Cup", year: 2031, groupCount: 12, teamCount: 48 })
      .returning();
    tournamentId = t.id;
  });

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it("GET /health is public", async () => {
    await request(server).get("/health").expect(200, { status: "ok" });
  });

  it("rejects an unauthenticated create with 401", async () => {
    await request(server)
      .post("/sweepstakes")
      .send({ tournamentId, name: "Nope", buyIn: 1000, expectedParticipants: 2 })
      .expect(401);
  });

  it("signs in via email code, then creates and lists a sweepstake", async () => {
    const agent = request.agent(server);
    const email = "http-org@kickstake.dev";

    await agent
      .post("/auth/email-otp/send-verification-otp")
      .send({ email, type: "sign-in" })
      .expect(200);

    const otp = testOtpStore.get(email);
    expect(otp).toMatch(/^\d{6}$/);

    await agent
      .post("/auth/sign-in/email-otp")
      .send({ email, otp })
      .expect(200);

    const created = await agent
      .post("/sweepstakes")
      .send({
        tournamentId,
        name: "Office WC",
        buyIn: 15000,
        donation: 0,
        expectedParticipants: 10,
      })
      .expect(201);

    expect(created.body.status).toBe("draft");
    expect(created.body.prizeCategories).toHaveLength(12);
    expect(created.body.designedPot).toBe(150000);

    const list = await agent.get("/sweepstakes").expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    // Owner can fetch detail
    await agent.get(`/sweepstakes/${created.body.id}`).expect(200);
  });
});
