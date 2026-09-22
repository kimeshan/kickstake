import { expect, type Page } from "@playwright/test";
import { Client } from "pg";

export const DB =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5437/kickstake";

export async function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  const client = new Client({ connectionString: DB });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

export async function demoChallenge() {
  const [row] = await query<{ id: string; join_token: string }>(
    "SELECT id, join_token FROM activity_challenge WHERE slug = 'demo-level-up'",
  );
  return { id: row.id, token: row.join_token };
}

export const uniqueEmail = (label: string) =>
  `e2e-ch-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@kickstake.dev`;

/** Completes the real email-code form on the current page, reading the OTP from the DB. */
export async function completeOtp(page: Page, email: string) {
  await page.getByPlaceholder("you@email.com").fill(email);
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
  let otp = "";
  await expect
    .poll(async () => {
      const rows = await query<{ value: string }>(
        "SELECT value FROM verification WHERE identifier = $1 ORDER BY created_at DESC LIMIT 1",
        [`sign-in-otp-${email}`],
      );
      otp = rows[0] ? String(rows[0].value).split(":")[0] : "";
      return otp.length;
    })
    .toBe(6);
  await page.getByPlaceholder("••••••").fill(otp);
  await page.getByRole("button", { name: /Verify/ }).click();
}

/** No horizontal page overflow (spreadsheet-style scrolling). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(0);
}

/**
 * A private challenge owned by the e2e organiser, on the demo calendar
 * (week 1 elapsed, week 2 current), so organiser tests can toggle settings
 * without disturbing parallel participant tests.
 */
export async function createOwnedChallenge(title = `Org ${Date.now()}`) {
  const token = `e2e${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const [row] = await query<{ id: string }>(
    `INSERT INTO activity_challenge
       (slug, title, organiser_id, start_date, week_count, time_zone, final_edit_cutoff, scoring_version, join_token)
     SELECT $1, $2, u.id, d.start_date, d.week_count, d.time_zone, d.final_edit_cutoff, d.scoring_version, $3
       FROM "user" u, activity_challenge d
      WHERE u.email = 'e2e-organiser@kickstake.dev' AND d.slug = 'demo-level-up'
     RETURNING id`,
    [`e2e-${token}`, title, token],
  );
  return { id: row.id, token, title };
}
