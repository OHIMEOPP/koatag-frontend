import { defineConfig, devices } from "@playwright/test";

/**
 * Drive feature e2e — spec §13.
 *
 * 跑前需要：
 * - dev server 起在 http://localhost:3000 (`npm start`)
 * - backend 起在 koatag.com:8123 (有 fixture 用 test-drive@example.com 帳號)
 * - 或 reuse 現有 user → 改 .env.test E2E_USER_EMAIL/E2E_USER_PASSWORD
 *
 * commands：
 * - `npm run e2e`           跑全部 (S1-S7)
 * - `npm run e2e:smoke`     PR smoke set (S1 + S3 + S6) per spec §13.3
 * - `npm run e2e:headed`    瀏覽器有頭跑 (debug)
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // drive shares one user 帳號，平行寫會撞
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
