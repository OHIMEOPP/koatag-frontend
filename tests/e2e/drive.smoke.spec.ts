import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginAsTestUser } from "./helpers/auth";

/**
 * PR smoke set per spec §13.3 — S1 / S3 / S6
 *
 * S6 (video Range) 暫 skip：backend MVP allow video mime 但需要 fixture 影片，
 * spec §13.2 沒指定編碼，現場無 sample.mp4。等 user 提供或 backend 給 fixture 後 enable。
 */
test.describe("Drive smoke (PR set)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
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

  test.skip("S6: 影片 Range request (206 Partial Content)", async ({ page }) => {
    // 需 sample.mp4 fixture + backend mime allowlist 含 video/*；user 提供後 enable
  });
});
