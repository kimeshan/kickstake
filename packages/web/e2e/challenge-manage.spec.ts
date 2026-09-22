import { test, expect, type Browser } from "@playwright/test";
import { completeOtp, createOwnedChallenge, expectNoHorizontalOverflow, uniqueEmail } from "./challenge-helpers";

// Organiser tools, as the e2e organiser (storageState) on a challenge they own.
// Participant contexts must opt out of the project's organiser session.
const SIGNED_OUT = { cookies: [], origins: [] };

async function participant(browser: Browser, token: string, name: string) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: SIGNED_OUT });
  const page = await ctx.newPage();
  await page.goto(`http://localhost:3800/challenges/join/${token}`);
  await completeOtp(page, uniqueEmail("org-p"));
  await page.getByLabel("Your name in the group").fill(name);
  await page.getByRole("button", { name: "Join challenge" }).click();
  await expect(page.getByRole("button", { name: "Update minutes" })).toBeVisible();
  return { ctx, page };
}

test("organiser corrects a total with a reason; participant sees it", async ({ page, browser }) => {
  const c = await createOwnedChallenge();
  const p = await participant(browser, c.token, "Corrina");
  await p.page.getByRole("button", { name: "Update minutes" }).click();
  await p.page.getByLabel("Total minutes this week").fill("100");
  await p.page.getByRole("button", { name: "Save total" }).click();
  await expect(p.page.getByText(/Saved: 100 minutes/).first()).toBeVisible();

  await page.goto(`/challenges/${c.id}/manage`);
  await expect(page.getByRole("heading", { name: "Organiser tools" })).toBeVisible();
  await expect(page.getByTestId("invite-url")).toContainText(`/challenges/join/${c.token}`);

  const card = page.locator("details").filter({ hasText: "Corrina" });
  await card.locator("summary").click();
  await card.getByLabel("New total (minutes)").fill("180");
  // Reason is required.
  await expect(card.getByRole("button", { name: "Save correction" })).toBeDisabled();
  await card.getByLabel("Reason (required)").fill("Told me on WhatsApp");
  await card.getByRole("button", { name: "Save correction" }).click();
  await expect(card.getByText(/Correction saved/)).toBeVisible();
  await expect(card.getByText("W2 180 min *")).toBeVisible();

  await p.page.reload();
  await expect(p.page.getByText("180", { exact: true }).first()).toBeVisible();
  await expect(p.page.getByText(/Updated by organiser/).first()).toBeVisible();

  // Weekly summary reflects the saved result.
  const summary = page.getByRole("textbox", { name: "Weekly summary" });
  await expect(summary).toHaveValue(/Group total: 180 min/);
  await expect(summary).toHaveValue(/1 of 1 at 150\+ minutes/);
  await p.ctx.close();
});

test("lock blocks participants; closing joining blocks newcomers; remove revokes access", async ({ page, browser }) => {
  const c = await createOwnedChallenge();
  const p = await participant(browser, c.token, "Lockie");

  await page.goto(`/challenges/${c.id}/manage`);
  await page.getByRole("switch", { name: "Participants can edit" }).click();
  await expect(page.getByRole("switch", { name: "Participants can edit" })).toHaveAttribute("aria-checked", "false");
  await p.page.reload();
  await expect(p.page.getByRole("button", { name: "Update minutes" })).toBeDisabled();
  await expect(p.page.getByText("The organiser has paused editing for now.")).toBeVisible();
  await page.getByRole("switch", { name: "Participants can edit" }).click();
  await expect(page.getByRole("switch", { name: "Participants can edit" })).toHaveAttribute("aria-checked", "true");

  await page.getByRole("switch", { name: "Joining open" }).click();
  await expect(page.getByRole("switch", { name: "Joining open" })).toHaveAttribute("aria-checked", "false");
  const fresh = await browser.newContext({ storageState: SIGNED_OUT });
  const fp = await fresh.newPage();
  await fp.goto(`http://localhost:3800/challenges/join/${c.token}`);
  await expect(fp.getByText("Joining is closed for this challenge.")).toBeVisible();
  await fresh.close();

  const card = page.locator("details").filter({ hasText: "Lockie" });
  await card.locator("summary").click();
  await card.getByRole("button", { name: "Remove from challenge" }).click();
  await card.getByRole("button", { name: "Yes, remove" }).click();
  await expect(page.getByText("Removed (1)")).toBeVisible();

  await p.page.reload();
  await expect(p.page.getByText(/Your place in this challenge was removed/)).toBeVisible();

  const removedCard = page.locator("details").filter({ hasText: "Lockie" });
  await removedCard.locator("summary").click();
  await removedCard.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText("Participants (1)")).toBeVisible();
  await p.page.reload();
  await expect(p.page.getByRole("button", { name: "Update minutes" })).toBeVisible();
  await p.ctx.close();
});

test("rotating the invitation retires the old link", async ({ page, browser }) => {
  const c = await createOwnedChallenge();
  await page.goto(`/challenges/${c.id}/manage`);
  await page.getByRole("button", { name: "Replace link" }).click();
  await page.getByRole("button", { name: "Yes, replace it" }).click();
  await expect(page.getByTestId("invite-url")).not.toContainText(c.token);

  const ctx = await browser.newContext({ storageState: SIGNED_OUT });
  const p = await ctx.newPage();
  await p.goto(`http://localhost:3800/challenges/join/${c.token}`);
  await expect(p.getByText(/This invitation link doesn't work/)).toBeVisible();
  await ctx.close();
});

test("CSV export has no emails and preserves blanks", async ({ page, browser }) => {
  const c = await createOwnedChallenge();
  const p = await participant(browser, c.token, "=Formula");
  await p.ctx.close();
  const res = await page.request.get(`/api/challenges/${c.id}/export.csv`);
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text.split("\r\n")[0]).toBe("challenge,display_name,week,start_date,end_date,minutes,level,medal,last_updated,update_source");
  expect(text).toContain(`"'=Formula",1,`);
  expect(text).not.toMatch(/@kickstake\.dev/);
  expect(text).not.toContain(c.token);
});

test("organiser page works on a phone and non-owners are refused", async ({ page, browser }) => {
  const c = await createOwnedChallenge();
  const p = await participant(browser, c.token, "Not The Boss With A Rather Long Name Indeed");
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`/challenges/${c.id}/manage`);
  await expect(page.getByRole("heading", { name: "Organiser tools" })).toBeVisible();
  await expect(page.getByText("Participants (1)")).toBeVisible();
  await page.locator("details").first().locator("summary").click();
  await expectNoHorizontalOverflow(page);

  await p.page.goto(`http://localhost:3800/challenges/${c.id}/manage`);
  await expect(p.page.getByText("Only the organiser can do that.")).toBeVisible();
  const r = await p.page.request.get(`http://localhost:3800/api/challenges/${c.id}/manage`);
  expect(r.status()).toBe(403);
  await p.ctx.close();
});
