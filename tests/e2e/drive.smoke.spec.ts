import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginAsTestUser, cleanupUserDrive } from "./helpers/auth";

/**
 * PR smoke set per spec §13.3 — S1 / S3 / S6
 */
test.describe("Drive smoke (PR set)", () => {
  test.beforeEach(async ({ page }) => {
    const token = await loginAsTestUser(page);
    // 跑 test 前把該 user root 清空，避免前 run 殘留汙染 assertion
    // shallow only（多層 folder 留 backend reset endpoint，spec §13.1）
    await cleanupUserDrive(token);
    await page.goto("/main/drive");
  });

  test("S1: 上傳 1MB 圖片", async ({ page }) => {
    const fixturePath = path.join(__dirname, "fixtures", "build", "1mb.jpg");
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    // 等 list refetch + 卡片渲染
    await expect(page.locator('.drive-card-file').first()).toBeVisible({ timeout: 15_000 });
    const cardName = await page.locator('.drive-card-name').first().textContent();
    expect(cardName).toContain("1mb.jpg");
    // QuotaIndicator 應該也更新
    await expect(page.locator('.drive-quota-text')).toContainText(/[0-9]/, { timeout: 5_000 });
  });

  test("S3: 建資料夾 + 進入 + 上傳", async ({ page }) => {
    // MVP UploadDropzone 沒 create-folder UI（spec §15.1 T11/T13 沒含）
    // → 改走 service API 建資料夾，frontend 只驗導航 + 上傳到子夾
    await test.step("create folder via API + reload", async () => {
      const token = await page.evaluate(() => localStorage.getItem("token"));
      const folderName = `pw-${Date.now()}`;
      const resp = await page.request.post(
        `${process.env.E2E_API_BASE || "http://koatag.com:8123/api"}/drive/folders`,
        {
          data: { name: folderName, parent_id: null },
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      expect(resp.ok()).toBe(true);
      await page.reload();
      await expect(page.locator(".drive-card-folder").filter({ hasText: folderName })).toBeVisible();

      // click 進去
      await page.locator(".drive-card-folder").filter({ hasText: folderName }).click();
      await expect(page).toHaveURL(/\/main\/drive\/folder\/\d+/);
    });

    await test.step("upload 1mb.jpg into the new folder", async () => {
      const fixturePath = path.join(__dirname, "fixtures", "build", "1mb.jpg");
      await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
      await expect(page.locator('.drive-card-file').first()).toBeVisible({ timeout: 15_000 });
    });
  });

  test("S6: 影片 Range request (206 Partial Content)", async ({ page }) => {
    // capture 206 partial content responses for any drive download endpoint
    const partialResponses: string[] = [];
    page.on("response", (r) => {
      if (r.status() === 206 && r.url().includes("/api/drive/files/")) {
        partialResponses.push(r.url());
      }
    });

    const fixturePath = path.join(__dirname, "fixtures", "sample.mp4");
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    // 11MB upload 等較久
    await expect(page.locator(".drive-card-file").first()).toBeVisible({
      timeout: 30_000,
    });

    // 進 file detail page
    await page.locator(".drive-card-file").first().click();
    await expect(page).toHaveURL(/\/main\/drive\/file\/\d+/);

    // VideoPlayer 應該渲染
    const video = page.locator(".drive-video");
    await expect(video).toBeVisible({ timeout: 10_000 });

    // preload="metadata" 觸發 → naturalDuration 應該有值
    await page.waitForFunction(
      () => {
        const v = document.querySelector(".drive-video") as HTMLVideoElement;
        return !!v && Number.isFinite(v.duration) && v.duration > 0;
      },
      null,
      { timeout: 15_000 },
    );

    // seek 觸發 Range request
    await video.evaluate((v: HTMLVideoElement) => {
      v.currentTime = Math.max(1, Math.floor(v.duration / 2));
    });
    await page.waitForTimeout(2_000);

    // 至少一個 206 Partial Content（preload metadata + seek）
    expect(partialResponses.length).toBeGreaterThan(0);
  });
});
