import { test, expect, type APIRequestContext } from "@playwright/test";

// Live prize money + knockout bracket. Runs with the organiser session from
// global-setup, against the demo results seeded there (groups + R32 finished).

async function createDrawnSweepstake(request: APIRequestContext) {
  const tournaments = await (await request.get("/api/tournaments")).json();
  const wc = tournaments.find(
    (t: { name: string }) => t.name === "2026 FIFA World Cup",
  );
  expect(wc).toBeTruthy();

  const created = await (
    await request.post("/api/sweepstakes", {
      data: {
        tournamentId: wc.id,
        name: `E2E Live ${Date.now()}`,
        buyIn: 10000,
        expectedParticipants: 2,
      },
    })
  ).json();

  for (const displayName of ["live ann", "live ben"]) {
    await request.post(`/api/j/${created.joinToken}/participants`, {
      data: { displayName },
    });
  }
  await request.post(`/api/sweepstakes/${created.id}/draw`, {
    data: { mode: "random" },
  });
  return created as { id: string; joinToken: string };
}

test("organiser dashboard shows live prize money and the knockout bracket", async ({
  page,
}) => {
  const s = await createDrawnSweepstake(page.request);
  await page.goto(`/dashboard/${s.id}`);

  // Live panel: leaderboard with both players and decided prize money.
  await expect(page.getByRole("heading", { name: "Live prizes" })).toBeVisible();
  await expect(page.getByText("Live Ann").first()).toBeVisible();
  await expect(page.getByText(/Prize results \(\d+\/\d+ decided\)/)).toBeVisible();

  // Stat prizes show their current front-runner (golden boot from seeded
  // demo scorers, best defence / biggest loss from scorelines).
  await page.getByText(/Prize results \(/).click();
  expect(
    await page.getByText(/Current leader/).count(),
  ).toBeGreaterThanOrEqual(3);

  // Bracket: person-vs-person cards with stage columns.
  await expect(page.getByRole("heading", { name: "Knockout bracket" })).toBeVisible();
  await expect(page.getByText("Round of 32")).toBeVisible();
  await expect(page.getByText("Round of 16")).toBeVisible();
});

test("participants see live prizes on the public page only after finalize", async ({
  page,
}) => {
  const s = await createDrawnSweepstake(page.request);

  // Not finalized yet — no live section on the public page.
  await page.goto(`/j/${s.joinToken}`);
  await expect(page.getByText(/Buy-in|buy/i).first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Live prizes" }),
  ).toHaveCount(0);

  await page.request.patch(`/api/sweepstakes/${s.id}`, {
    data: { finalized: true },
  });

  await page.reload();
  await expect(page.getByRole("heading", { name: "Live prizes" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Knockout bracket" })).toBeVisible();
});
