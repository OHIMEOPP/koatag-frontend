import { test, expect } from "@playwright/test";
import * as path from "path";
import { createEphemeralUser, destroyEphemeralUser } from "./helpers/auth";

/**
 * v3 video onError refresh e2e (commit `f3c3566`)
 *
 * 驗 `<video onError>` → `useDriveStreamUrl.refresh()` → retry-once → 成功:
 * 1. Playwright route handler 攔第一次 `/api/drive/files/{id}/download?sig=...` 回 403 FORBIDDEN
 * 2. `<video>` onError fire → handleVideoError → refreshCountRef < 1 → refresh()
 * 3. refresh: invalidateSigCache(fileId) + bumpKey → useEffect re-run
 * 4. 第二次 POST /stream-url 拿新 sig → new URL → `<video src>` 變
 * 5. 瀏覽器自動重新 GET /download → 第二次攔截 pass through → backend 真服
 *
 * spec §13.2 沒列此 case，是 wiki #323 點到的 v3 onError 真 work verify。
 */
test.describe("v3 video onError refresh", () => {
  let ephemeralUserId: number;

  test.beforeEach(async ({ page }) => {
    const u = await createEphemeralUser(page);
    ephemeralUserId = u.userId;
  });

  test.afterEach(async () => {
    await destroyEphemeralUser(ephemeralUserId);
  });

  test("video onError → refresh → retry-once 成功", async ({ page }) => {
    let downloadHits = 0;
    let signPostCount = 0;

    // 必須在 page.goto 前 register route + listener
    await page.route(/\/api\/drive\/files\/\d+\/download\?/, async (route) => {
      downloadHits++;
      if (downloadHits === 1) {
        // 第一次：模擬 sig expired
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({
            ok: false,
            error: {
              code: "FORBIDDEN",
              message: "simulated expired sig",
              details: { reason: "expired" },
            },
          }),
        });
      } else {
        // 之後 pass through 到真 backend
        await route.continue();
      }
    });

    page.on("request", (r) => {
      if (r.url().endsWith("/stream-url") && r.method() === "POST") {
        signPostCount++;
      }
    });

    await page.goto("/main/drive");

    // 上傳 sample.mp4
    await page.locator('input[type="file"]').first().setInputFiles(
      path.join(__dirname, "fixtures", "sample.mp4"),
    );
    await expect(page.locator(".drive-card-file").first()).toBeVisible({
      timeout: 30_000,
    });

    // 進 detail page，VideoPlayer mount
    await page.locator(".drive-card-file").first().click();
    await expect(page).toHaveURL(/\/main\/drive\/file\/\d+/);

    // 等 onError → refresh → 第二次 sign POST + 第二次 download fire
    // refresh 流程：onError → setRefreshKey → useEffect → POST /stream-url → setUrl → <video src 變> → GET /download
    // 5s 給整段 round trip + React render 餘裕
    await page.waitForTimeout(5_000);

    // 至少有兩次 download：第一次 403、第二次 retry
    expect(downloadHits).toBeGreaterThanOrEqual(2);

    // refresh 觸發新 sign：mount 一次 + refresh 一次 = ≥ 2
    expect(signPostCount).toBeGreaterThanOrEqual(2);

    // 最終 video element 應該仍 visible（沒 fall back 到 persistent error）
    const video = page.locator(".drive-video");
    await expect(video).toBeVisible({ timeout: 5_000 });

    // persistent error UI 不該出現
    await expect(page.locator(".drive-video-error")).toHaveCount(0);
  });

  test("video onError 第二次仍失敗 → 顯 persistent error，不無限 loop", async ({ page }) => {
    let downloadHits = 0;

    await page.route(/\/api\/drive\/files\/\d+\/download\?/, async (route) => {
      downloadHits++;
      // 永遠 403 模擬持續失敗
      await route.fulfill({
        status: 403,
        contentType: "application/json",
        body: JSON.stringify({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "persistent failure",
            details: { reason: "expired" },
          },
        }),
      });
    });

    await page.goto("/main/drive");
    await page.locator('input[type="file"]').first().setInputFiles(
      path.join(__dirname, "fixtures", "sample.mp4"),
    );
    await expect(page.locator(".drive-card-file").first()).toBeVisible({
      timeout: 30_000,
    });
    await page.locator(".drive-card-file").first().click();
    await expect(page).toHaveURL(/\/main\/drive\/file\/\d+/);

    // 等 MAX_AUTO_REFRESH=1 retry 完成後 persistent error 顯示
    await page.waitForTimeout(6_000);

    // 應該顯示 persistent error
    await expect(page.locator(".drive-video-error")).toBeVisible();
    await expect(page.locator(".drive-video-error")).toContainText(/影片載入失敗/);

    // download 不該超過 mount + 1 retry = 2 次
    // 但 video element 自己可能多 fire onError（同一 src 多次嘗試），refresh 已 cap 在 1
    // 所以 downloadHits 上限是 2 個不同 URL（mount 第一個 + retry 第二個）
    expect(downloadHits).toBeLessThanOrEqual(3); // 保留 1 個彈性對 React 18 StrictMode double-mount
  });
});
