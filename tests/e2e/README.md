# Drive e2e (T15)

Playwright e2e for KOATAG Drive feature。對應 spec §13。

## Setup

### 1. 環境變數

複製 `.env.test.example` 成 `.env.test`（or export 到 shell）：

```bash
E2E_BASE_URL=http://localhost:3000           # frontend dev server
E2E_API_BASE=http://koatag.com:8123/api       # backend
# backend container 需 APP_E2E_ENABLED=true 開放 ephemeral user endpoints
# loginAsTestUser fallback (dev manual smoke) 才需:
# E2E_USER_EMAIL=...
# E2E_USER_PASSWORD=...
```

### 2. 產 fixture 檔（`1mb.jpg` + `60mb.bin`）

```bash
npx ts-node tests/e2e/fixtures/generate.ts
```

`60mb.bin` 是 zero-fill 60MB；`1mb.jpg` 從 `public/0cb1...jpg` 複製過來。

### 3. 安裝瀏覽器

```bash
npx playwright install chromium
```

### 4. 跑 dev server (另開 terminal)

```bash
npm start
```

## Running

```bash
npm run e2e            # 全部 (S1-S7)
npm run e2e:smoke      # spec §13.3 PR smoke set (S1+S3+S6)
npm run e2e:headed     # 開瀏覽器 debug
npm run e2e:fixtures   # 重新產 fixture
```

## Scenarios 對應 spec §13.2

| ID | Scenario | Status |
|---|---|---|
| S1 | 上傳 1MB 圖片 | ✅ 實作 in `drive.smoke.spec.ts` |
| S2 | 60MB 前端 reject | ✅ 實作 in `drive.full.spec.ts` |
| S3 | 建資料夾 + 進入 + 上傳 | ⚠️ 用 service API 建資料夾（前端沒 create-folder UI） |
| S4 | rename / move / delete | ⚠️ 跳過 move（沒 sub-folder fixture） |
| S5 | 同名檔上傳 | ✅ |
| S6 | 影片 Range request 206 | ✅ 實作 — `sample.mp4` 已在 `tests/e2e/fixtures/`（11.2MB H.264）|
| S7 | lightbox magnifier + canvas CORS | ✅（端到端 verify cross-origin canvas read）|

## 已知限制

1. ~~**沒 backend test reset endpoint**~~ — ✅ Phase 2 Task 3 (backend `2a7716a`)
   `POST/DELETE /api/test/users/ephemeral` env-guarded by `APP_E2E_ENABLED=true`。
   specs beforeEach 用 `createEphemeralUser`，afterEach `destroyEphemeralUser`
   cascade。**per-test isolation + parallel-safe** — `playwright.config workers`
   仍 1，follow-up 才 flip。

2. ~~**Test user 必須先在 backend 手動 create**~~ — ✅ ephemeral 自動造，
   prefix `e2e_ephemeral_*` fence 防誤刪真 user。

3. **S6 video** — `sample.mp4` 已 commit 進 fixtures/（11.2MB BlueStacks recording）。
   spec 用 `page.on("response")` server-side hook 收 206 status（避開 cross-origin opaque）。

4. **Folder isolation** — ephemeral user 各自獨立 drive，folder name 撞無關。
