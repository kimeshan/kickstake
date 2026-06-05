import { test, expect } from "@playwright/test";

// Authed organiser creates a sweepstake, then the share link is opened in a
// FRESH (incognito-style) context with no session — reproducing the reported
// /j/<token> 404 so it can never regress.

test("a shared join link works in a fresh browser with no account", async ({
  page,
  browser,
}) => {
  await page.goto("/dashboard/new");
  const name = `Join E2E ${Date.now()}`;
  await page.getByPlaceholder("Office World Cup '26").fill(name);
  await page.getByRole("button", { name: "Create KickStake" }).click();
  await expect(page).toHaveURL(/\/dashboard\/[0-9a-f-]{36}/);

  // Grab the share link off the detail page.
  const linkText = await page.getByText(/\/j\//).first().innerText();
  const token = linkText.split("/j/")[1].trim();
  expect(token.length).toBeGreaterThan(0);

  // Open it with no session, like a participant clicking the link.
  const ctx = await browser.newContext();
  const p2 = await ctx.newPage();
  const res = await p2.goto(`http://localhost:3800/j/${token}`);
  expect(res?.status(), "join link must not 404").toBeLessThan(400);

  await expect(p2.getByRole("heading", { name })).toBeVisible();
  await p2.getByPlaceholder("Your name").fill("Thandi");
  await p2.getByRole("button", { name: /Join the KickStake/i }).click();
  await expect(p2.getByText(/You're in!/)).toBeVisible();

  await ctx.close();
});

test("organiser runs a random draw once 2+ players have joined", async ({
  page,
}) => {
  await page.goto("/dashboard/new");
  await page.getByPlaceholder("Office World Cup '26").fill(`Draw ${Date.now()}`);
  await page.getByRole("button", { name: "Create KickStake" }).click();
  await expect(page).toHaveURL(/\/dashboard\/[0-9a-f-]{36}/);

  const linkText = await page.getByText(/\/j\//).first().innerText();
  const token = linkText.split("/j/")[1].trim();

  // Two participants join via the public API.
  for (const displayName of ["alice", "BOB"]) {
    const r = await page.request.post(
      `http://localhost:3800/api/j/${token}/participants`,
      { data: { displayName } },
    );
    expect(r.ok()).toBeTruthy();
  }

  await page.reload();
  // With 2 players loaded, the draw panel offers Randomize.
  const randomize = page.getByRole("button", { name: /Randomize/i });
  await expect(randomize).toBeVisible();
  await randomize.click();
  await expect(page.getByText("Teams drawn")).toBeVisible();
});

test("prizes can be edited and must reconcile to the pot", async ({ page }) => {
  await page.goto("/dashboard/new");
  await page.getByPlaceholder("Office World Cup '26").fill(`Prizes ${Date.now()}`);
  await page.getByRole("button", { name: "Create KickStake" }).click();
  await expect(page).toHaveURL(/\/dashboard\/[0-9a-f-]{36}/);

  await page.getByRole("button", { name: "Manage prizes" }).click();
  // Reconciliation bar shows the allocated/pot state.
  await expect(page.getByText(/Allocated/i)).toBeVisible();
  // Auto-generated structure is balanced, so Save is enabled.
  await expect(page.getByRole("button", { name: "Save prizes" })).toBeEnabled();
});
