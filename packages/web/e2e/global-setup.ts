import { request } from "@playwright/test";
import { Client } from "pg";

/**
 * Authenticates a test organiser once, before the authed project runs, and
 * saves the session cookie to storageState. Reads the one-time code straight
 * from the verification table (better-auth stores it as "<otp>:<attempts>").
 */
const EMAIL = "e2e-organiser@kickstake.dev";
const APP = process.env.E2E_BASE_URL ?? "http://localhost:3800";
const DB =
  process.env.DATABASE_URL ??
  "postgres://postgres:postgres@localhost:5437/kickstake";

async function retry<T>(fn: () => Promise<T>, attempts = 30): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw lastErr;
}

export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: APP });

  // Wait for the stack to be up, then request a sign-in code.
  await retry(async () => {
    const res = await ctx.post("/api/auth/email-otp/send-verification-otp", {
      data: { email: EMAIL, type: "sign-in" },
    });
    if (!res.ok()) throw new Error(`send-otp ${res.status()}`);
  });

  // Read the freshly-issued OTP from the DB.
  const client = new Client({ connectionString: DB });
  await client.connect();
  const { rows } = await client.query(
    "SELECT value FROM verification WHERE identifier = $1 ORDER BY created_at DESC LIMIT 1",
    [`sign-in-otp-${EMAIL}`],
  );
  await client.end();
  if (!rows.length) throw new Error("No OTP found in verification table");
  const otp = String(rows[0].value).split(":")[0];

  const signIn = await ctx.post("/api/auth/sign-in/email-otp", {
    data: { email: EMAIL, otp },
  });
  if (!signIn.ok()) throw new Error(`sign-in ${signIn.status()}`);

  await ctx.storageState({ path: "e2e/.auth/organiser.json" });

  // Warm Next dev's on-demand route compilation so parallel tests don't each
  // pay a cold-compile cost (which can blow past per-test timeouts).
  await Promise.all(
    ["/", "/login", "/dashboard", "/dashboard/new", "/dashboard/warmup", "/j/warmup"].map(
      (p) => ctx.get(p).catch(() => {}),
    ),
  );

  await ctx.dispose();
}
