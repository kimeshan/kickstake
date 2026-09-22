import { test, expect, type Page } from "@playwright/test";
import {
  completeOtp,
  demoChallenge,
  expectNoHorizontalOverflow,
  uniqueEmail,
} from "./challenge-helpers";

// Participant flow on a phone: invitation → email code → name → join →
// My progress → replace-never-add saving → Group → Rules.

async function joinAsNewParticipant(page: Page, name: string) {
  const { id, token } = await demoChallenge();
  await page.goto(`/challenges/join/${token}`);
  await expect(page.getByRole("heading", { name: "Demo Level Up" })).toBeVisible();
  await expect(page.getByText(/visible to other people in this challenge/).first()).toBeVisible();
  await completeOtp(page, uniqueEmail("p"));
  await page.getByLabel("Your name in the group").fill(name);
  await page.getByRole("button", { name: "Join challenge" }).click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${id}$`));
  return { id, token };
}

async function saveMinutes(page: Page, value: string) {
  await page.getByRole("button", { name: "Update minutes" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Total minutes this week").fill(value);
  await dialog.getByRole("button", { name: "Save total" }).click();
}

test("invite → sign in → join → save replaces, never adds", async ({ page }) => {
  const { id, token } = await joinAsNewParticipant(page, "Playwright Pat");

  // Demo challenge: week 2 is current, so that's the default.
  await expect(page.getByText(/^Week 2 · /).first()).toBeVisible();
  await expect(page.getByText("No total entered yet")).toBeVisible();

  await saveMinutes(page, "150");
  await expect(page.getByText(/Saved: 150 minutes for/).first()).toBeVisible();
  await expect(page.getByText("Level 1 · Bronze").first()).toBeVisible();
  await expect(page.getByText("50 min to Level 2")).toBeVisible();

  await saveMinutes(page, "200");
  await expect(page.getByText(/Saved: 200 minutes for/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("200", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("350")).toHaveCount(0);

  // Reopening the invitation goes straight to progress (no duplicate membership).
  await page.goto(`/challenges/join/${token}`);
  await expect(page).toHaveURL(new RegExp(`/challenges/${id}$`));
  await expectNoHorizontalOverflow(page);
});

test("minutes input rejects bad values, confirms big ones and clears to Not entered", async ({ page }) => {
  await joinAsNewParticipant(page, "Validator Val");

  await page.getByRole("button", { name: "Update minutes" }).click();
  const dialog = page.getByRole("dialog");
  const input = dialog.getByLabel("Total minutes this week");

  await input.fill("1.5");
  await expect(dialog.getByText(/Whole minutes only/)).toBeVisible();
  await input.fill("-5");
  await expect(dialog.getByText(/Whole minutes only/)).toBeVisible();
  await input.fill("20000");
  await expect(dialog.getByText(/10,080 max/)).toBeVisible();
  await input.fill("");
  await dialog.getByRole("button", { name: "Save total" }).click();
  await expect(dialog.getByText(/Enter a number of minutes/)).toBeVisible();

  // >1,000 asks for confirmation, then saves.
  await input.fill("1200");
  await dialog.getByRole("button", { name: "Save total" }).click();
  await expect(dialog.getByText(/20 h 0 min/)).toBeVisible();
  await dialog.getByRole("button", { name: "Yes, save it" }).click();
  await expect(page.getByText("Level 11 · Platinum").first()).toBeVisible();
  await expect(page.getByText("Highest level reached")).toBeVisible();

  // Clear → Not entered (not zero).
  await page.getByRole("button", { name: "Update minutes" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clear this week's entry" }).click();
  await page.getByRole("button", { name: "Yes, clear it" }).click();
  await expect(page.getByText("No total entered yet")).toBeVisible();

  // Explicit zero stays zero.
  await saveMinutes(page, "0");
  await expect(page.getByText("Level 0 · Building").first()).toBeVisible();
});

test("elapsed weeks can be backfilled; future weeks are read-only", async ({ page }) => {
  await joinAsNewParticipant(page, "Backfill Bea");
  await page.getByRole("button", { name: "Previous week" }).click();
  await expect(page.getByText(/^Week 1 · /).first()).toBeVisible();
  await saveMinutes(page, "175");
  await expect(page.getByText(/Saved: 175 minutes for/).first()).toBeVisible();

  await page.getByRole("button", { name: "Next week" }).click();
  await page.getByRole("button", { name: "Next week" }).click();
  await expect(page.getByText(/^Week 3 · /).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Update minutes" })).toBeDisabled();
  await expect(page.getByText("This week hasn't started yet.")).toBeVisible();
});

test("group results show names and levels but never emails", async ({ page }) => {
  const { id } = await joinAsNewParticipant(page, "Group Gus");
  await saveMinutes(page, "320");
  await expect(page.getByText(/Saved: 320 minutes/).first()).toBeVisible();

  await page.getByRole("link", { name: "Group" }).click();
  await expect(page).toHaveURL(new RegExp(`/challenges/${id}/group$`));
  const me = page.getByRole("listitem").filter({ hasText: "Group Gus" }).filter({ hasText: "You" });
  await expect(me).toContainText("You");
  await expect(me).toContainText("Level 4 · Silver");
  await expect(page.getByText(/@kickstake\.dev/)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "Rules" }).click();
  await expect(page.getByRole("heading", { name: "Level ladder" })).toBeVisible();
  await expect(page.getByText("1,000+")).toBeVisible();
});

test("signed-out challenge pages return to the challenge after sign-in, not /dashboard", async ({ page }) => {
  const { id } = await demoChallenge();
  await page.goto(`/challenges/${id}/rules`);
  await expect(page).toHaveURL(/\/login\?next=/);
  await completeOtp(page, uniqueEmail("ret"));
  // Signed in but not a member → the challenge's own "not a member" state.
  await expect(page).toHaveURL(new RegExp(`/challenges/${id}/rules$`));
  await expect(page.getByText(/You're not part of this challenge/)).toBeVisible();
});

test("login ignores off-site return paths", async ({ page }) => {
  await page.goto("/login?next=//evil.example.com/x");
  await completeOtp(page, uniqueEmail("evil"));
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("invalid invitation shows a designed state, and invite links resolve", async ({ page, request }) => {
  await page.goto("/challenges/join/not-a-real-token");
  await expect(page.getByText(/This invitation link doesn't work/)).toBeVisible();

  const { token } = await demoChallenge();
  await page.goto(`/challenges/join/${token}`);
  await expect(page.getByRole("heading", { name: "Demo Level Up" })).toBeVisible();
  const hrefs = await page.$$eval("a[href]", (els) =>
    els.map((e) => e.getAttribute("href") ?? "").filter((h) => h.startsWith("/") && !h.startsWith("//")),
  );
  for (const href of [...new Set(hrefs)]) {
    const res = await request.get(href);
    expect(res.status(), `${href} should resolve`).toBeLessThan(400);
  }
});

test("participant flow has no horizontal overflow at 320px", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await joinAsNewParticipant(page, "A very long display name that goes on and on ok");
  await expectNoHorizontalOverflow(page);
  await page.getByRole("button", { name: "Update minutes" }).click();
  await expectNoHorizontalOverflow(page);
  await expect(page.getByRole("button", { name: "Save total" })).toBeInViewport();
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("link", { name: "Group" }).click();
  await expect(page.getByText("A very long display name").first()).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await page.getByRole("link", { name: "Rules" }).click();
  await expect(page.getByRole("heading", { name: "Level ladder" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
