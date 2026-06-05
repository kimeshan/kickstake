import { test, expect } from "@playwright/test";

test("landing page renders the hero and key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("sorted");
  await expect(page.getByText("The end of sweepstake admin")).toBeVisible();
  await expect(page.getByText("From idea to kickoff")).toBeVisible();
});

test("no internal link on the landing page 404s", async ({ page, request }) => {
  await page.goto("/");
  const hrefs = await page.$$eval("a[href]", (els) =>
    els
      .map((e) => e.getAttribute("href") ?? "")
      .filter((h) => h.startsWith("/") && !h.startsWith("//")),
  );
  const unique = [...new Set(hrefs)];
  expect(unique.length).toBeGreaterThan(0);
  for (const href of unique) {
    const res = await request.get(href);
    expect(res.status(), `${href} should resolve`).toBeLessThan(400);
  }
});

test("unauthenticated /dashboard redirects to /login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("/dashboard/new is gated too (no silent 404)", async ({ page }) => {
  const res = await page.goto("/dashboard/new");
  // proxy redirects to /login when unauthenticated — never a 404.
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveURL(/\/login/);
});

test("login page shows the email step and advances to the code step", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(page.getByText("Kick off your KickStake")).toBeVisible();
  await page.getByPlaceholder("you@email.com").fill("e2e-login@kickstake.dev");
  await page.getByRole("button", { name: "Send me a code" }).click();
  await expect(page.getByText("Check your inbox")).toBeVisible();
});

test("language switch to Arabic flips the document to RTL", async ({
  context,
  page,
}) => {
  await context.addCookies([
    { name: "NEXT_LOCALE", value: "ar", url: "http://localhost:3800" },
  ]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
});
