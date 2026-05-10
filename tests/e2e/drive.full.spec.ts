import { test, expect } from "@playwright/test";
import * as path from "path";
import { loginAsTestUser, cleanupUserDrive } from "./helpers/auth";

test.describe("Drive full scenarios", () => {
  test.beforeEach(async ({ page }) => {
    const token = await loginAsTestUser(page);
    await cleanupUserDrive(token);
    await page.goto("/main/drive");
  });

  test("S2: 60MB 上傳被前端 reject (no /api/drive/files POST)", async ({ page }) => {
    const driveFilesPosts: string[] = [];
    page.on("request", (r) => {
      if (r.method() === "POST" && r.url().includes("/api/drive/files")) {
        // exclude /stream-url + /sign-* — only count the upload POST root
        const u = new URL(r.url());
        if (u.pathname.endsWith("/api/drive/files")) {
          driveFilesPosts.push(r.url());
        }
      }
    });

    const fixturePath = path.join(__dirname, "fixtures", "build", "60mb.bin");
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);

    // 期望 UploadProgressList 顯示 error item
    const errItem = page.locator(".drive-upload-item-error, .drive-upload-item-name").filter({ hasText: /50MB/ });
    await expect(errItem.first()).toBeVisible({ timeout: 5_000 });

    // 沒有 axios POST 送出 (50MB guard 在 enqueue 前生效)
    expect(driveFilesPosts).toHaveLength(0);
  });

  test("S4: rename / move / delete", async ({ page }) => {
    // upload 一檔
    const fixturePath = path.join(__dirname, "fixtures", "build", "1mb.jpg");
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.locator('.drive-card-file').first()).toBeVisible({ timeout: 15_000 });

    // rename
    await page.locator(".drive-card-file").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /重新命名/ }).click();
    const input = page.locator(".drive-modal-input");
    await input.fill("renamed-by-pw.jpg");
    await page.getByRole("button", { name: /確認/ }).click();
    await expect(page.locator(".drive-card-name").first()).toContainText("renamed-by-pw.jpg");

    // delete via confirm
    page.once("dialog", (d) => d.accept());
    await page.locator(".drive-card-file").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: /刪除/ }).click();
    await expect(page.locator(".drive-card-file")).toHaveCount(0, { timeout: 10_000 });
  });

  test("S5: duplicate names co-exist", async ({ page }) => {
    const fixturePath = path.join(__dirname, "fixtures", "build", "1mb.jpg");
    // 上傳兩次同檔
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.locator('.drive-card-file').first()).toBeVisible({ timeout: 15_000 });
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    // 等第二張卡片
    await expect(page.locator('.drive-card-file')).toHaveCount(2, { timeout: 15_000 });
  });

  test("S7: lightbox magnifier (canvas CORS)", async ({ page }) => {
    // 假設有上傳的 image，進詳情頁
    const fixturePath = path.join(__dirname, "fixtures", "build", "1mb.jpg");
    await page.locator('input[type="file"]').first().setInputFiles(fixturePath);
    await expect(page.locator('.drive-card-file').first()).toBeVisible({ timeout: 15_000 });
    await page.locator(".drive-card-file").first().click();
    await expect(page).toHaveURL(/\/main\/drive\/file\/\d+/);

    // 點放大 → fullscreen viewer + magnifier
    await page.locator(".drive-img-preview").click();
    await expect(page.locator(".fs-viewer")).toBeVisible();
    const img = page.locator(".fs-viewer .magnifier-main");
    await expect(img).toBeVisible();

    // verify cross-origin canvas read
    const result = await img.evaluate((el: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = 50;
      canvas.height = 50;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(el, 0, 0, 50, 50);
      try {
        canvas.toDataURL();
        ctx.getImageData(0, 0, 1, 1);
        return { tainted: false };
      } catch (e) {
        return { tainted: true, error: String(e) };
      }
    });
    expect(result.tainted).toBe(false);
  });
});
