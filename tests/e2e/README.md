# Drive e2e (T15)

Playwright e2e for KOATAG Drive feature。對應 spec §13。

## Setup

### 1. 環境變數

複製 `.env.test.example` 成 `.env.test`（or export 到 shell）：

```bash
E2E_BASE_URL=http://localhost:3000          # frontend dev server
E2E_API_BASE=http://koatag.com:8123/api      # backend
E2E_USER_EMAIL=test-drive@example.com        # spec §13.1 fixture user
E2E_USER_PASSWORD=...                        # 該 user 密碼
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
| S6 | 影片 Range request 206 | ⏸ skipped — 需 sample.mp4 fixture + backend video mime allowlist verify |
| S7 | lightbox magnifier + canvas CORS | ✅（端到端 verify cross-origin canvas read）|

## 已知限制

1. **沒 backend test reset endpoint** — beforeEach 沒清理 user drive；spec §13.1 寫
   「test API 或 DB seed」backend 沒提供。當前 test order 自由，多跑會累積 test data。
   v2 backend 加 `POST /test/reset-user` (test env only) 後 enable。

2. **Test user 必須先在 backend 手動 create** — spec §13.1 說 `test-drive@example.com` quota
   100MB；實際用 register API 建 user + 設 quota（非 frontend 範圍）。

3. **S6 video** — 需 `sample.mp4` fixture（現場無）+ backend `mime in:image/*,video/*` allowlist
   確認。

4. **Folder isolation** — 多個 test 共享 root，撞名靠 `pw-${Date.now()}` 後綴緩解。
   無 transaction rollback。
