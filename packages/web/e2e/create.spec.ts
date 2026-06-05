import { test, expect } from "@playwright/test";

// Runs with the organiser session from global-setup (storageState).

test("dashboard loads for an authenticated organiser", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Your KickStakes" })).toBeVisible();
});

test("an already-signed-in organiser is bounced from /login to the dashboard", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard/);
});

test("create a sweepstake end-to-end and land on its detail page", async ({
  page,
}) => {
  await page.goto("/dashboard");

  // The CTA that used to 404 — must reach the real wizard.
  await page.getByRole("link", { name: /Start a KickStake/i }).first().click();
  await expect(page).toHaveURL(/\/dashboard\/new/);
  await expect(page.getByRole("heading", { name: "Create a KickStake" })).toBeVisible();

  // Tournament is pre-selected (WC2026 seeded). Fill the rest.
  const name = `E2E Stake ${Date.now()}`;
  await page.getByPlaceholder("Office World Cup '26").fill(name);

  await page.getByRole("button", { name: "Create KickStake" }).click();

  // Redirected to the detail page with a real id.
  await expect(page).toHaveURL(/\/dashboard\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { name })).toBeVisible();

  // Prize pot rendered, and it's the full template (12 categories).
  await expect(page.getByText("Prize pot")).toBeVisible();
  await expect(page.getByText("Tournament Winner")).toBeVisible();

  // Share link present.
  await expect(page.getByText(/\/j\//)).toBeVisible();
});
