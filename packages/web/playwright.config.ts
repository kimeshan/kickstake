import { defineConfig, devices } from "@playwright/test";

const PORT = 3800;
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "public",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authed",
      testMatch: /(create|join)\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/organiser.json",
      },
    },
  ],
  // Reuses an already-running `pnpm dev` (web + api). If nothing is up, starts
  // the full stack from the workspace root. E2E also needs Postgres running
  // and seeded (pnpm postgres:dev && pnpm db:seed).
  webServer: {
    command: "pnpm -w run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
