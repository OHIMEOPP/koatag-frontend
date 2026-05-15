# KOATAG Drive — 三方共識 Spec

> 版本：v1.2 (post-MVP 階段對照表 + 進度同步)
> 日期：2026-05-14（v1.0 / v1.1 freeze 於 2026-05-09）
> 主辦人：使用者（cool901215@gmail.com，KOATAG solo dev）
> 三方：koatag-frontend (jack frontend agent) / koatag (jack backend agent) / wiki (life_wiki agent)
> 監軍：wiki — implement 階段觀察 koatag-frontend + koatag 是否偏離本 spec（正式 SOP：`life_wiki/wiki/concepts/雲端硬碟設計/subtopics/監軍角色SOP.md`）
>
> ⚠️ 本文件為「契約層 source of truth」。實作細節見：
> - **backend detail**：`C:\Users\User\Desktop\VSCcode\KOATAG\CLOUD_DRIVE_BACKEND_SPEC.md` 實質 v1.5（1132 行；標頭仍 v1.0 — 等 koatag patch）
> - **frontend detail**：`C:\Users\User\Desktop\VSCcode\KOATAG-frontend\koatag-frontend\CLOUD_DRIVE_FRONTEND_SPEC.md` 實質 v1.2（1016 行；標頭仍 v1.1 — 等 koatag-frontend patch）
> - **可行性背景**：`koatag-frontend/CLOUD_DRIVE_FEASIBILITY.md`
> - **wiki review**：`life_wiki/wiki/output/cloud-drive-spec-review-2026-05-09.md` (commit `eea06a9`)
> - **wiki 監軍對齊報告**：`life_wiki/wiki/output/koatag-drive-alignment-2026-05-14.md`
> - **wiki 8 篇技術 reference**：`life_wiki/wiki/concepts/雲端硬碟設計/` (commit `4611e3c+`)

---

## 0. 共識決議表（freeze）

| 決議 | 內容 | 出處 |
|---|---|---|
| **架構** | module-A：同 backend repo 新增 `app/Modules/Drive/`，DB 同 `my_db`，table 前綴 `drive_*`，user table 完全共用 | koatag spec §0 |
| **不引 package** | 自行 PSR-4 autoload，不上 `nwidart/laravel-modules` | koatag spec §0 |
| **storage 抽象** | 沿用 Laravel `Storage` facade，新增 `'drive'` disk（`visibility=private`）。既有 image 用 `'public'` disk，零衝突（verified） | koatag spec §6 |
| **配額** | 獨立 table `drive_user_quota`，預設 5GB/user（`.env: DRIVE_DEFAULT_QUOTA=5368709120`），不動 users table | koatag spec §2.5 |
| **影片串流** | 雙模式：dev 走 Laravel `BinaryFileResponse`（artisan serve）；prod 走 nginx `X-Accel-Redirect` + `internal;` location。靠 `DRIVE_USE_X_ACCEL` env 切，frontend 完全無感 | koatag spec §13.5 |
| **Image 與 Drive 邊界** | 完全分開，配額只算 Drive，image 不回算。v2 加 `drive_files.image_data_id` nullable FK 才連結 | koatag spec §0 |
| **上傳大檔** | MVP 50MB 硬拒（HTTP 413 + `FILE_TOO_LARGE`），前端 client-side guard + 後端 defense in depth；v4 才上 tus 分塊 | koatag spec §0, frontend §5.1 |
| **同資料夾重名** | 接受重名，前端顯示後端回的 `name`（後端不去重），不做 `(1)` `(2)` 自動 | koatag spec §0 |
| **資料夾樹** | adjacency list (`parent_id`) + MySQL 8 recursive CTE 取麵包屑 / ancestor。防迴圈在 service 層 walk | koatag spec §2.2, §5.2 |
| **分享機制** | `drive_shares` (ACL, 對 user) + `drive_share_links` (Capability, 公開 token URL)，MVP 只 `read` 權限 | koatag spec §2.3, §2.4 |
| **Folder share** | 支援；access check 走 ancestor recursive CTE 一發查清，不 N+1 | koatag spec §5.2 |
| **API 回應格式** | 統一 `{ok, data}` / `{ok:false, error:{code, message, details}}`。list 用 `{ok, data:{items}, meta:{total, page, size, total_pages}}` | koatag spec §9, frontend §3 |
| **API 命名邊界** | API body / query 一律 `snake_case`。前端用 (a) **service 層手動轉換**（KOATAG 是 solo project，避免 magic conversion）。例外：`error.code` SCREAMING_SNAKE 不轉、`audit` event name 不轉 | frontend §3.0 |
| **audit channel** | 統一走 `audit` channel，event prefix `drive.*`（17 條 event）+ 既有 `access.denied`（IDOR） | koatag spec §8 |
| **IDOR** | 既有 `JwtMiddleware.php:28-39` 已防 IDOR（path user_id ≠ JWT user_id → 403 + audit），所有 image/tag route 在 `Route::middleware('jwt')->group()` 內，零漏掛（verified）。MVP 不動 image route，v3 才做 URL hygiene | koatag spec §1, §13 Q8 |
| **Sort case** | case-insensitive natural sort（MySQL `utf8mb4_unicode_ci` 預設），sort 欄位走 DB 名（`name | size_bytes | created_at | updated_at`），UI label 對映 | koatag spec, frontend §3.1 |
| **分頁** | offset 制，`?page=&size=` (size cap 200)，meta 在 top-level | frontend §3.1, koatag spec §3.1 |
| **share token** | 32 char base62 ≈ 190 bit entropy（`Str::random(32)`，crypto-safe） | koatag spec §2.4 |
| **儲存路徑** | `storage/app/drive/{userFolder}/{file_id 前2字 hex}/{file_id}_{checksum[:8]}.{ext}` | koatag spec §6 |
| **Quota 軟刪語義** | 軟刪 30 天回收期內**不釋放** quota（避免誤刪後爆 quota race），cron job 30 天後 hard delete 才釋放 | koatag spec §7 |
| **回應格式統一範圍** | drive 走新 pattern + 順便統一 image endpoint（v3 階段才做） | koatag spec §1 |

---

## 1. DB Schema 契約（5 張 table）

完整 SQL 見 `CLOUD_DRIVE_BACKEND_SPEC.md` §2。摘要：

```
drive_files       — id PK, owner_id FK, folder_id NULL FK, name, storage_path,
                    mime, size_bytes, checksum_sha1, thumb_path, soft delete
drive_folders     — id PK, owner_id FK, parent_id NULL FK (adjacency), name, soft delete
drive_shares      — (resource_type, resource_id, grantee_id) UNIQUE,
                    permission read|write, expires_at NULL
drive_share_links — token CHAR(32) UNIQUE, resource_type/_id, max_uses, use_count,
                    expires_at NULL, revoked_at NULL
drive_user_quota  — user_id PK FK, quota_bytes, used_bytes, lazy-create
```

引擎 / charset：`InnoDB / utf8mb4_unicode_ci`。

⚠️ MySQL 不支援跨表 polymorphic FK；`drive_shares.resource_id` / `drive_share_links.resource_id` 對 file or folder 由 service 層保證一致性。

---

## 2. Routes 契約（27 個 endpoint）

完整列見 `CLOUD_DRIVE_BACKEND_SPEC.md` §3。

| 區 | endpoint 範圍 |
|---|---|
| **Files** (7) | `GET/POST /api/drive/files` / `{id}` / `{id}/download` / `{id}/thumb` |
| **Trash (Files)** (3, v3) | `GET /api/drive/files/trash` / `POST /{id}/restore` / `DELETE /{id}?permanent=1` |
| **Folders** (6) | `GET/POST /api/drive/folders` / `{id}` / `{id}/breadcrumb` |
| **Shares** (4) | `POST /api/drive/shares` / `incoming` / `outgoing` / `DELETE /{id}` |
| **Share Links** (3) | `POST /api/drive/share-links` / `outgoing` / `DELETE /{id}` |
| **Quota** (1) | `GET /api/drive/quota` |
| **Public** (3) | `/api/p/{token}` / `/{token}/download` / no auth (v3) |

**契約細節**：
- `?download=1` query 切 `Content-Disposition: attachment`，預設 `inline`
- list endpoint 全部支援 `?folder_id=&sort=&order=&q=&page=&size=` (size cap 200)
- 所有 drive route **不在 path 帶 `{user_id}`**，user 從 JWT 取（attribute `auth_user_id`）

---

## 3. Error Code 契約（25 個 codes）

完整對照表見 `CLOUD_DRIVE_BACKEND_SPEC.md` §9 + `CLOUD_DRIVE_FRONTEND_SPEC.md` §4。

| 類別 | Codes |
|---|---|
| 認證授權 | `UNAUTHORIZED` (401) / `FORBIDDEN` (403) / `IDOR_DENIED` (403) |
| 資源不存在 | `NOT_FOUND` / `FILE_NOT_FOUND` / `FOLDER_NOT_FOUND` (404) |
| 上傳限制 | `FILE_TOO_LARGE` (413) / `INVALID_MIME` (415) / `QUOTA_EXCEEDED` (413) / `UPLOAD_NO_FILE` (422) / `UPLOAD_FAILED` (500) |
| 樹結構操作 | `FOLDER_NOT_EMPTY` (409) / `MOVE_INTO_DESCENDANT` (409) / `INVALID_PARENT` (422) |
| 命名 | `NAME_REQUIRED` (422) / `NAME_TOO_LONG` (422) |
| 分享 | `SHARE_SELF` (422) / `SHARE_DUPLICATE` (409) |
| Share Link | `SHARE_LINK_EXPIRED` / `SHARE_LINK_REVOKED` / `SHARE_LINK_USED_UP` (410) / `SHARE_LINK_INVALID` (404) |
| **Trash (v3)** | `OUTSIDE_RETENTION` (422) / `NOT_TRASHED` (422) |
| 兜底 | `INTERNAL_ERROR` (500) |

**權限 404 vs 403 convention（v3 沿用 backend 既有 destroy pattern）**：跨 user 試 restore / permanent_delete 一律回 `FILE_NOT_FOUND` (404) **不**回 `FORBIDDEN` (403) — 防 existence-enumeration 攻擊（攻擊者用 ID 掃 file ownership map）。同 `destroy` / `update` 既有行為。

**回應結構**：
```jsonc
{ "ok": false, "error": { "code": "QUOTA_EXCEEDED", "message": "...", "details": {...} } }
```

詳細 details fields 對應請看 backend spec §9 / frontend spec §4.1。

---

## 4. Audit Event 契約（20 條 + 1 既有）

完整列見 `CLOUD_DRIVE_BACKEND_SPEC.md` §8。前端 subscribe `audit` log channel + filter prefix `drive.*`。

```
drive.upload.{success, fail}     drive.download[.public]      drive.delete
drive.move                        drive.rename                  drive.folder.{create, delete}
drive.share.{granted, revoked}    drive.share_link.{created, revoked, accessed}
drive.quota.{warn, deny, recomputed}
drive.restore                     drive.permanent_delete[.storage_fail]  (v3 D.9)
+ access.denied (既有，含 reason: user_id_mismatch IDOR)
```

⚠️ **不新增** `drive.idor.attempt`，沿用既有 `access.denied` event。

---

## 5. 部署層 Checklist

完整見 `CLOUD_DRIVE_BACKEND_SPEC.md` §10。摘要：

| 層 | 動作 |
|---|---|
| **PHP** | `upload_max_filesize=50M / post_max_size=55M / memory_limit=256M` (改 docker-compose.yml line 27 sed 從 500M 降回 55M) |
| **nginx** (prod) | `client_max_body_size 55M` + `location /internal/drive/ { internal; alias /var/www/html/storage/app/drive/; }` |
| **docker-compose** | 沿用既有 storage volume，dev 走 `php artisan serve` 模式 + `DRIVE_USE_X_ACCEL=false` |
| **.env** | `DRIVE_MAX_SYNC_UPLOAD=52428800`、`DRIVE_DEFAULT_QUOTA=5368709120`、`DRIVE_CHUNKED_ENABLED=false`、`DRIVE_DISK=drive`、`DRIVE_USE_X_ACCEL=false` (dev) / `true` (prod) |
| **filesystems.php** | 加 `'drive' => ['driver' => 'local', 'root' => storage_path('app/drive'), 'visibility' => 'private', 'throw' => false]` |
| **drive.php** (新檔) | `default_quota_bytes / max_sync_upload_bytes / soft_delete_retention_days=30 / quota_warn_threshold=0.80` |
| **MySQL** | `mysql:8.0`（verified，recursive CTE 支援）|
| **Docker base** | `php:8.2-fpm` Debian（verified，apt-get 可裝 ffmpeg）|

deploy 順序：env + config → PHP/nginx config + rebuild → migration → code → smoke test。

---

## 6. MVP Exclusion List（明確不做）

| Item | 何時做 |
|---|---|
| 上傳 > 50MB | v4 (tus chunked upload) |
| 影片 HLS / 多解析度 | v4 |
| 影片 poster frame (ffmpeg) | v2 |
| 全文搜尋 (FTS) | v4，MVP 只檔名 LIKE |
| Share write permission | v3，MVP 只 read |
| Share link `max_uses` UI | v3 (schema 已留欄位) |
| `drive_files.image_data_id` 對應 | v2 alter，MVP 不預留欄位（YAGNI） |
| Trash / 還原 UI | v3 |
| Mime 黑名單 | v2 |
| ffmpeg docker 安裝 | v2 |
| S3 / MinIO 切換 | v5 評估 |
| nginx X-Accel-Redirect 啟用 | v2 (route/code 預備，env switch off) |
| Image endpoint `{user_id}` 拔除 | v3 (URL hygiene) |

---

## 7. Implement 起跑 Task 清單

### 7.1 啟動條件 ✅ 全部達成

- ✅ 三方 spec freeze candidate
- ✅ wiki review 完成（5 必修全處理 + 5 optional 列入 backlog + 2 verify 由 koatag close）
- ✅ **使用者最終 GO**（2026-05-09 implement 階段啟動）
- ✅ wiki 監軍角色 ack（msg #168 + SOP v1.2 升級於 2026-05-14）

### 7.2 第一批 P0 (MVP) — 後端 ✅ 全部完成

backend：
- [x] B1: migration 5 張 drive_* table
- [x] B2: `app/Modules/Drive/` 結構建立 (Controllers / Services / Repositories / Models / Middleware)
- [x] B3: `JwtMiddleware` 加一行 `attributes->set('auth_user_id', ...)`
- [x] B4: `config/filesystems.php` + `config/drive.php` 新檔
- [x] B5: `DriveStorageService` (含 `serveFile()` 雙模式 X-Accel/BinaryFileResponse 切)
- [x] B6: `DriveAclService` (recursive CTE access check)
- [x] B7: `DriveQuotaService` (transaction lock + assertCanUpload/consume/release/recompute)
- [x] B8: `DriveFileController` + `DriveFileRepository` (index / show / upload / update / destroy / download / thumb)
- [x] B9: `DriveFolderController` + `DriveFolderRepository` (含 breadcrumb endpoint)
- [x] B10: `DriveShareController` + `DriveShareRepository`
- [x] B11: `DriveShareLinkController` + `DriveShareLinkRepository`
- [x] B12: `DriveQuotaController`
- [x] B13: docker-compose post_max_size 50M→55M + .env 加變數
- [x] B14: nginx config (prod) + internal location
- [x] B15: audit event 17 條接入既有 audit channel
- [x] B16: PHPUnit MVP 7 個 scenario 測試
- [x] B17: DriveSignedUrlService + signStreamUrl endpoint + JwtMiddleware 不過 download/thumb route 拆分（spec freeze 後新加，backend §16）

### 7.3 第一批 P0 (MVP) — 前端 ✅ 全部完成

frontend：
- [x] T1: `driveService.ts` skeleton + `axios.ts` interceptor unwrap + `DriveServiceError`
- [x] T2: `errorMap.ts` 23 codes + i18n key
- [x] T3: zustand stores (`folderTreeStore` / `driveQuotaStore` / `uploadQueueStore`)
- [x] T4: `DrivePage` route + Sidebar entry + lazy load
- [x] T5: `Breadcrumb` + `FileGrid` + `FileList` + view toggle
- [x] T6: `FileCard` / `FolderCard` (mime icon)
- [x] T7: `SortMenu` + `SearchBar` (debounce 300ms)
- [x] T8: `UploadDropzone` + 50MB guard
- [x] T9: `UploadProgressList` + `useUploadScheduler` (max 3 並行)
- [x] T10: `QuotaIndicator` (sidebar 底)
- [x] T11: `ContextMenu` (rename / move / delete)
- [x] T12: `VideoPlayer` (preload metadata, `streamUrl(id)`)
- [x] T13: `DriveFilePage` (lightbox / video player 整合)
- [x] T14: Playwright e2e setup + S1-S7

### 7.4 第二批 P1 (v2-v3) — 進度混合

post-MVP 階段 task 完整對照見 §7.6。簡要：
- [x] image endpoint URL hygiene 統一 → **延後到 v3，MVP 維持向後相容**
- [x] 影片 poster frame (ffmpeg) → ❌ **未做（需先裝 ffmpeg）**
- [x] image_data_id alter → ✅ **done**（backend §17）
- [x] Share dialog UI (frontend) + write permission (backend) → ✅ **done**（v? Phase 2B + backend §18）
- [x] /drive/shared/in / out 列表頁 → ✅ **done**
- [x] /drive/share/:token landing → ✅ **done**（含 v?-zip folder share download）
- [ ] Trash UI → ❌ **未做**（schema 已 soft delete + 30 天 retention 邏輯 backend done）

### 7.5 第三批 P2 (v4-v5) — 未動工

- [ ] tus chunked upload (前後端)
- [ ] HLS player wrapper
- [ ] FTS 搜尋 (SQLite FTS5 or Postgres tsvector)
- [ ] S3 / MinIO presigned URL 切換評估

### 7.6 Post-MVP 已完成 v? 階段對照表

P0 freeze 後實際做的事，列為三方共識正式紀錄（避免 contract spec 漏記 source of truth）。詳見 backend §17/§18 + frontend `DEPLOY_CHECKLIST_FRONTEND.md`。

| v? task | scope | backend ref | frontend ref | wiki 監軍 status |
|---|---|---|---|---|
| **B17 sig URL** | DriveSignedUrlService + stream-url endpoint + JwtMiddleware 拆分 | §16 | service 簽名 sync→async | ✅ ack |
| **v2 image_data_id link** | drive_files 加 nullable INT FK 對 new_img_data；minimal cross-ref pattern | §17 | lightbox `driveFileToImageProps` 接 | ✅ ack |
| **v2 canvas CORS** | sig URL endpoint expose ACAO for `<img crossOrigin>` | §17.7c | `<img crossOrigin="anonymous">` + canvas drawImage | ✅ verified 2026-05-10 |
| **v?-zip** | folder share-link 公開下載 → zip stream（`/api/p/{token}/download` dispatch zip）| MVP exclusion 改 done 標 + audit event `drive.download` kind=`folder_zip` + `drive.share_link.zip_aborted` 等 | ShareLinkLandingPage folder UI | ✅ ack 2026-05-11 |
| **v? Phase 1** | UserSearchAutocomplete + ShareDialog 接 user search | 新 `/api/drive/users/search` endpoint + audit `drive.users.search` | commit `7423150` UserSearchAutocomplete | 🚨 wiki 漏接（per-feature mailbox 沒寄）|
| **v? Phase 2A** | ephemeral test user helper + 3 specs refactor | router-level `APP_E2E_ENABLED` 三層防護 | commit `6f7b1d7 / 32603f9` | 🚨 wiki 漏接 |
| **v? Phase 2B** | write share permission UI + edit + revoke cascade trace | §18 ACL grant scope + revoke cascade move files | commit `9519279` ShareDialog + ACL tab edit + ConfirmDialog | 🚨 wiki 漏接 |
| **v? Phase 2C** | borrowed permission disable in ContextMenu | （frontend Option B short-term）| commit `237049a` ContextMenu disable | 🚨 wiki 漏接 |
| **v3 video onError refresh** | sig 過期自動 retry 一次 | （reuse 既有 stream-url）| VideoPlayer onError + 新 sig fetch | 🚨 wiki 漏接 |
| **A 層 deploy fix** | drive disk visibility public + chmod 0644 既有檔 | §11 Rule 8 + DEPLOY_CHECKLIST §1.5 | — | ✅ ack 2026-05-11 #428 |
| **B 層 deploy fix** | nginx `/internal/drive/` CORS header (mirror Laravel allow list) | §11 Rule 9 + §16.6 caveat | — | ✅ ack 2026-05-11 #434 |
| **C 層 deploy fix** | `^~ /internal/drive/` priority 強制 prefix > regex | §11 Rule 10 + §16.6 caveat | — | ✅ ack 2026-05-11 #448 |

**dev verify all green（13 項皆 dev pass）/ prod reload 套用 A+B+C 待 user 動作。**

🚨 標記項：wiki 監軍漏接 per-feature mailbox round（違反 SOP §3.1）。事後 review 由本次對齊報告補做，紀律 reset 於 2026-05-14。

### 7.6b Post-MVP autonomous overnight 2026-05-15 round（D.4-D.10）

| Task | scope | backend ref | frontend ref | wiki 監軍 status |
|---|---|---|---|---|
| **D.4 MIME 黑名單** | config/drive.php `mime_blacklist` 12 entry runtime-verified（4 binary + 7 script + 1 PHP legacy）| §11 v2 done note | （無前端 work）| ✅ ack 2026-05-14 + commit ced32f1 prod-deployed |
| **D.1 backend prod deploy** | A+B+C 三層 fix + D.4 + signed URL secret 全 prod 化 | DEPLOY_CHECKLIST.md Tier 0 | （無前端 work）| ✅ ack 2026-05-14 6/6 case + prod-deployed |
| **D.1 frontend prod deploy** | main.9a59f655 build + docker cp 進 container | （無 backend work）| commit `f387203` build artifact | ✅ infra-level done 2026-05-15；browser smoke 7 case 等 user 醒來手動 |
| **D.5 watcher TTL 24hr** | （無）| （無）| （無）| ✅ ack 2026-05-15 commit cff19af |
| **D.6 影片 poster frame** | Dockerfile + ffmpeg + DriveThumbnailService video branch | §11 v2 done note | （無前端 work）| ⏸️ code+spec done，image built sha256:4e715b5b，container swap 等 user GO |
| **D.9 v3 Trash UI (file only)** | 3 routes + 2 error codes + 3 audit events + cascade restore caveat | §3/§8/§9/§11 v3 partial done | service+store+page+sidebar+TrashContextMenu+cascade hint | ✅ scaffold close 2026-05-15；browser smoke 4 case 等 user morning |
| **D.10 v3 Breadcrumb 截斷** | grantee chain truncate at root-most share entry point | §5.2b + §11 v3 partial done | （response shape 不變，前端透明）| ✅ live 2026-05-15 6/6 case pass（OPcache `kill -USR2 1` 已 reload，不需 image rebuild）|

### 7.7 目前 backlog（contract 認可，未動工）

_最後校準: 2026-05-15 overnight round spec drift cleanup（已 done 但 spec ❌ 未 strike 的項，從本表移除：Share write permission / Share link max_uses UI / drive_files.image_data_id / 影片 streaming X-Accel 啟用）_

| Tier | item | 觸發後預估 |
|---|---|---|
| v3 | Image endpoint `{user_id}` 拔除（URL hygiene）| 跨 image module 影響面，前後端 ~1-2 天 |
| v? | Storage GC cron（清 race-fail orphan disk file + 30 day trash hard-delete）| backend ~半天（destructive risk，建議 user oversight）|
| v? | Folder trash（cascade restore + hard delete 邏輯）| backend ~半天 + 前端 ~1 天 |
| v? | OOM risk on 10k+ folder zip（in-memory traverse → generator pattern）| backend ~半天（D.11 caveat） |
| v4 | tus chunked upload (>50MB 解禁)| 前後端 ~3-5 天 |
| v4 | HLS player wrapper | 前後端 ~2 天 |
| v4 | FTS 全文搜尋 | 前後端 ~3 天 |
| v5 | S3 / MinIO 切換評估 | architectural decision round |

---

## 8. wiki 監軍角色（v1.2 — 已獨立成 SOP）

> 📄 **正式 SOP 移至** `life_wiki/wiki/concepts/雲端硬碟設計/subtopics/監軍角色SOP.md`（v1.2，9 章正式版，吸收 A→B→C deploy phase 學習）。本段保留摘要當 contract 內快速對照；若有衝突以 SOP 為準。
>
> ⚠️ 使用者 2026-05-09 在 wiki session 直接宣布升級指示（mailbox msg #167 記錄），原 v1.0「每批 task 對齊」升級為「**每完成一項功能**對齊」。

### 8.1 升級後的核心契約

> 「從現在開始到完成前，妳都是 driver 系統製作監軍。讓 frontend、koatag 記錄下來。在實作階段，**每完成一項功能**，都要向 wiki 確認並對齊，然後進行**功能細節測試**與**合理性**。三方完成資訊、功能皆**無任何功能與邏輯問題**才能進下一步。」 — 使用者

### 8.2 wiki 三層 check

每收到「功能完成」mailbox，wiki 跑：
1. **對齊 check**：diff 對 spec（schema / routes / error codes / audit events / contract 是否偏離 §0-§5）
2. **測試 check**：附上的 test scenario 是否覆蓋該功能 happy path + edge case
3. **合理性 check**：design 是否有 race / UX 漏洞 / 安全洞 / 邏輯錯誤

回信 ✅ 或 ⚠️。**⚠️ 必須三方共同確認 + 修完 + re-check 才能繼續**。

### 8.3 Per-feature 對齊流程（強制）

每當 koatag-frontend / koatag 完成一項 §7 task（B1, B2, ..., T1, T2, ...）：

```
mailbox to: wiki
body:
  功能 X 完成。
  - task: <T<N> 或 B<N>>
  - diff: <commit hash / PR URL / 直接貼 diff 摘要>
  - spec 對應段落: <CLOUD_DRIVE_SPEC.md §X / FRONTEND/BACKEND_SPEC §Y>
  - 自測結果: <已跑 e2e 哪幾條 / lint pass / build pass>
  - 想請 wiki 額外 check 的點: <如果有>
```

**不可跳過**：即使 task 看起來簡單。

### 8.4 SLA

mailbox 寄 wiki 後：
- 預期 wiki 在 N 個 user-prompt cycle 內回（一般快則 1-2 turn）
- 卡住可 escalate 給 user
- 此 SLA 保護 koatag-frontend / koatag 不會被 wiki 卡住 implement 流程

### 8.5 wiki 限制（caveats，msg #166）

1. **Reactive agent**：wiki 不主動 poll repos，**必須由 koatag-frontend / koatag 主動 mailbox 觸發**。忘了寄 = 流程偏離
2. **Cross-machine**：wiki 看不到 KOATAG / koatag-frontend repo 的 git log，**diff 要附在 mailbox 內**或叫 user 讓 wiki 讀
3. **spec 改動**：任何 schema / route / error code / audit event 變更要先回 spec → 再實作（不可反向：先實作再回頭改 spec）

### 8.6 監軍 deliverable

- **逐功能 review report**：每收到 mailbox，回信 ✅/⚠️ 含三層 check 結果
- **批次對齊報告**：當 P0/P1/P2 任一階段全部 task 完成（任一方 mailbox 宣布），wiki 出一份「批次總結」mailbox 給三方

### 8.7 放行條件

- ✅ wiki ✅
- ✅ 對應 koatag-frontend / koatag 對方也 ack（跨前後端的合約 task 兩邊都要點頭）
- ✅ 任何 ⚠️ 都修完 + re-check
- → 才進 §7 下一條 task

---

## 9. 引用文獻（wiki 7 篇 reference）

對應 `life_wiki/wiki/concepts/雲端硬碟設計/`（commits `b50904d` + `4611e3c`）：

| 文獻 | 對應 spec 章節 |
|---|---|
| `subtopics/HTTP-Range-Requests.md` | §2 Files routes（download / thumb），§5 影片串流 |
| `subtopics/Resumable-Upload-Protocol.md` | §6 MVP exclusion (v4 tus) |
| `subtopics/Object-Storage-設計.md` | §0 storage 抽象，§5 storage path |
| `subtopics/ACL-vs-Capability權限模型.md` | §0 分享機制（drive_shares=ACL / drive_share_links=Capability 混血策略） |
| `subtopics/X-Accel-Redirect.md` | §0 影片串流，§5 部署層 nginx config |
| HLS pipeline | backlog (v4) |
| FTS5 / Postgres FTS | backlog (v4) |

---

## 10. 引用其他文件

- `koatag-frontend/CLOUD_DRIVE_FEASIBILITY.md` — 可行性背景（為何後端必動 / 為何 module-A）
- `KOATAG/CLOUD_DRIVE_BACKEND_SPEC.md` v1.4 — backend 完整實作細節
- `koatag-frontend/CLOUD_DRIVE_FRONTEND_SPEC.md` v1.2 — frontend 完整實作細節
- `life_wiki/wiki/output/cloud-drive-spec-review-2026-05-09.md` — wiki review report（commit `eea06a9`）

---

## 11. 變更歷史

| 版本 | 日期 | 變更 |
|---|---|---|
| v1.0 | 2026-05-09 | 三方 spec freeze candidate 彙整成單一文件，wiki 任 implement 階段監軍 |
| v1.1 | 2026-05-09 | §8 監軍角色升級：使用者宣布「每完成一項功能對齊」「三方無任何問題才下一步」（msg #167）；新增 wiki 三層 check / per-feature 流程模板 / SLA / caveats |
| v1.2 | 2026-05-14 | §7 task list 同步 implement 進度（P0 全 done 勾選）+ 新增 §7.6 post-MVP v? 階段對照表（B17 / v2 image_data_id / canvas CORS / v?-zip / v? Phase 1-2C / v3 video onError / A+B+C deploy fix 共 12 項）+ §7.7 backlog 表；§8 監軍角色精簡指向獨立 SOP（`life_wiki/wiki/concepts/雲端硬碟設計/subtopics/監軍角色SOP.md`）。對應 wiki 監軍對齊報告 `koatag-drive-alignment-2026-05-14.md`。 |

---

## 12. spec freeze 簽署狀態

| 角色 | 狀態 | 出處 |
|---|---|---|
| koatag-frontend | ✅ frontend spec 實質 v1.2（標頭仍 v1.1，等 patch）| msg #160 + 待 header bump ack 2026-05-14 |
| koatag | ✅ backend spec 實質 v1.5（標頭仍 v1.0，等 patch）| msg #156 + 待 header bump ack 2026-05-14 |
| wiki | ✅ review 5 必修全 close + 監軍角色 v1.2 SOP 升級完 | msg #150 + 2026-05-14 |
| 使用者 | ✅ 最終 GO（2026-05-09 implement 啟動）| — |

---

(end of spec)
