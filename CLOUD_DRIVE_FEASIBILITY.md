# KOATAG Drive — 雲端硬碟功能可行性評估

> 討論日期：2026-05-08
> 目標：在 KOATAG 內加入完整雲端硬碟功能，並決定後端架構走向
> 結論：全做在 KOATAG 範圍內，但**後端拆兩個 module / service**，共用 user 帳號 namespace

---

## 1. 需求清單（使用者列）

- 上傳：檔案、圖片、影片
- 下載：所有類型
- 圖片：預覽 + 全螢幕（lightbox）
- 影片：網頁播放
- 排序：多種類型
- 搜尋：依檔名 / meta
- 與他人帳號的檔案共享
- 自訂資料夾
- 隱私保護
- 儲存空間限制（quota）

---

## 2. 為什麼非後端協作不可（不是純 UI 任務）

KOATAG 目前後端 model 是「Image + Tag」（見 `reference_backend_api_surface.md`），雲端硬碟核心抽象是「File + Folder + ACL + Quota」，幾乎沒重疊。後端非新增不可。

### 後端要動的點

| 需求 | 後端必做的事 |
|---|---|
| 任意檔案 / 影片上傳 | 不能複用現有 image endpoint。新增 **File model**（`mime`, `size`, `checksum`, `owner_id`, `folder_id`），儲存策略改為走 object storage 介面（先本地 fs 也 ok，但 API 介面要照 S3 抽） |
| 大檔 / 影片上傳 | **Resumable / chunked upload**（tus protocol 或自家 multipart），不然斷網重來等於沒做 |
| 影片網頁播放 | HTTP **Range request** 支援（不能整支 `file_get_contents` 吐出來），理想是抽 HLS 切片 |
| 圖片預覽 / 縮圖 | 已有 `thumb_path`（image_area），可重用 pipeline；影片要用 ffmpeg 抽 poster frame |
| 自訂資料夾 | Folder tree（adjacency list 或 materialized path），支援移動 / 重命名 / 刪除 |
| 共享 | ACL：`(file_id, grantee_user_id, permission)`；或 share link（unguessable token + 過期時間） |
| 隱私 | 每個 endpoint 都要 owner check，不像 public tags 那樣全開 |
| 配額 | `user.quota_bytes` + `user.used_bytes`，上傳前 check、刪檔時遞減 |
| 搜尋 | 至少檔名 LIKE，理想用 SQLite FTS5 或 Postgres tsvector，含 meta（mtime、tag） |
| 排序 | 後端支援 `?sort=name|size|mtime|type&order=asc|desc`，前端排序撐不住分頁 |

### 前端要做的（相對單純）

- 上傳元件：react-dropzone + 進度條 + 斷點續傳 client
- 檔案 grid / list 切換 + 排序選單
- 影片 `<video>` + Range 串流
- 圖片 lightbox：可重用 `image_area` 全螢幕 viewer
- 麵包屑（Breadcrumb）+ 資料夾樹
- 共享對話框（指定 user 或產生 share link）
- 配額顯示（剩餘空間 progress bar）

---

## 3. 後端拆兩個 module / service 的做法（使用者選定）

### 共用 user 帳號 namespace 的兩種拆法

**A. 同一 backend repo，分 module / 分 table 前綴（推薦先走這個）**

```
koatag-backend/
├── modules/
│   ├── tag/         # 既有：Image, Tag, ImageTag
│   └── drive/       # 新增：File, Folder, Share, Quota
└── shared/
    └── auth/        # User, Session（共用）
```

- DB 同一個，table 前綴 `drive_*`
- User table 完全共用，跨服務分享只要 `grantee_user_id` 即可
- migration 一致，部署單一 service
- 需要拆 service 時再拆，這時介面已經抽好

**B. 兩個獨立 service，共用 auth service / user table**

```
koatag-tag-service/    ─┐
                         ├─ 共用 koatag-auth-service（User, Session）
koatag-drive-service/  ─┘
```

- 各自獨立 DB，但 user_id 是同一個 namespace
- 需要 service 之間互信（JWT 共用 secret 或走 auth service 驗 token）
- 部署複雜，但流量爆表時好擴

### 推薦路徑

**先 A 再 B**：開新 module `drive/`，DB 同個但 table 前綴 `drive_*`。介面（storage adapter、ACL service、quota service）抽乾淨，未來要拆 B 不用大改。

### 帳號共享機制（兩種模式都支援）

1. **指定 user 分享**：`share` table = `(file_id, grantee_user_id, permission, granted_at, expires_at?)`
   - 因為共用 user table，直接打 user_id 就行
2. **share link 分享**：`(file_id, token, permission, expires_at)`
   - 不需對方有帳號，給連結就能存取
   - token 用 unguessable random（≥128 bit entropy）

---

## 4. Wiki 建議補的技術文獻

`life_wiki/wiki/concepts/` 目前沒這些，建議 INGEST：

1. **HTTP Range Request / Partial Content**（RFC 7233）— 影片播放 / 斷點續傳的根
2. **Resumable Upload Protocol**（tus.io 或 Google resumable upload）— 大檔上傳標準
3. **Object Storage 設計**（S3 API、MinIO）— 即使先用本地 fs，介面也要照這個抽
4. **ACL vs Capability-based 權限模型** — 共享機制選型
5. **影片轉碼 / HLS pipeline**（ffmpeg + 切片）— 多解析度 / 自適應碼率
6. **SQLite FTS5 / Postgres FTS** — 檔案搜尋

---

## 5. 規模 / 工期粗估（待跟 koatag 後端對齊）

以 module-A 拆法為基準：

| 階段 | 範圍 | 粗估 |
|---|---|---|
| MVP | 上傳 / 下載 / 資料夾 / 列表 / 排序 / 搜尋（檔名 LIKE） | 2-3 週前後端 |
| v2 | 圖片預覽 / 影片 Range 播放 / 縮圖 / poster frame | +1-2 週 |
| v3 | 共享（user + share link）/ 配額 / 隱私強化 | +1-2 週 |
| v4 | HLS 串流 / FTS 全文搜尋 / 斷點續傳 | +2-3 週 |

→ 完整版約 **6-10 週前後端**，視後端人力。

---

## 6. 下一步（todo）

- [ ] 跟 koatag 後端發 mailbox 對齊：現有 storage 架構能否延伸 / 是否走 module-A
- [ ] 確認共用 user table 的細節（auth flow、session 是否共用）
- [ ] 把上面 6 篇技術文獻 INGEST 進 wiki
- [ ] MVP scope 凍結後拆 task

---

## 7. 三條鐵律提醒（feedback memory）

1. 非純 UI 問 koatag — 這整個 feature 都不是純 UI，每一步都要對齊後端
2. 改完瀏覽器測 — 上傳 / 影片播放 / 共享流程都要 playwright 跑過
3. 動工前對照 `claude_design_整合前ui` 看差異 — 如果整合前 ui 有 drive 相關 mockup，以那個為準
