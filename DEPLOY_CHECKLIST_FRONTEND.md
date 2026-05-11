# Frontend Deploy Checklist — v? 三 task release

對應 wiki #414 Tier 0 deploy ops 派工。

涵蓋 commits：
- `7423150` Phase 1 UserSearchAutocomplete + ShareDialog wire
- `d58c0f9` Phase 1 follow-up console.warn raw err
- `6f7b1d7` Phase 2A ephemeral test user helper + 3 specs refactor
- `32603f9` Phase 2A README sync
- `9519279` Phase 2B write share permission UI + edit + revoke cascade trace
- `237049a` Phase 2C borrowed permission disable in ContextMenu

merged to `main` at `9a9438c`（github）。

---

## 1. Pre-deploy verify (local)

```bash
# 1.1 確認在 main branch latest
git checkout main
git pull github main
git log -1 --oneline   # expect 9a9438c or later

# 1.2 確認 .env 對 prod 環境
# REACT_APP_API_URL=http://koatag.com:8123/api   ← dev
# 改成 prod URL（若有 reverse proxy / 公網 domain）
cat .env

# 1.3 production build verify（local sanity）
npm run build
# expect:
# - exit 0 (zero error)
# - File sizes after gzip:
#   ~206 KB main.js + ~44 KB main.css + 1 KB drive chunk
# - warnings 是 legacy jsx-pascal-case (Icon components)，acceptable
```

**Expected outcome**: build success, bundle ~250 KB gzip total。
**Failure fallback**: build error → 查 typecheck `npx tsc --noEmit` + 修 → re-run。

---

## 2. Deploy

KOATAG 既有 multi-stage docker build (`devops/dockerfiles/Dockerfile`) →
nginx:stable-alpine static serve port 80 (mapped to 3000)。

```bash
# 2.1 在 host 機器 pull latest main
git pull github main
git log -1 --oneline   # confirm 9a9438c+

# 2.2 build new image
cd devops/docker-compose
docker compose build koatag-fontend
# expect:
# - build context: ../../
# - npm install --force ok
# - npm run build ok
# - nginx:stable-alpine 接收 /app/build

# 2.3 (rollback prep) 記下舊 image digest
docker images | grep koatag_fontend  # 取 IMAGE ID 留底

# 2.4 stop + start new
docker compose up -d koatag-fontend
docker compose ps   # expect koatag_fontend up

# 2.5 health: curl 內部
curl -I http://localhost:3000/
# expect HTTP/1.1 200 OK, Content-Type: text/html
```

**Expected outcome**: container up，curl returns SPA index.html。
**Failure fallback**: container start 失敗 → `docker compose logs koatag-fontend`
→ 大多是 nginx config / port 衝突；若 image 本身壞 rollback (見 §5)。

---

## 3. Post-deploy browser smoke (real prod URL)

使用者本人手動跑（每步驟標 expected outcome）。撞失敗即 §5 rollback。

### 3.1 Phase 1 user search

開瀏覽器 → 登入 → 進 `/main/drive` →
- 右鍵任一 file/folder card → ContextMenu → 點「分享…」 → ShareDialog 開
- 「邀請特定使用者」tab → input 框輸入 2 字以上（e.g., 別人 account 開頭 2 字）
- 等 300ms → dropdown 出現結果

**Expected**:
- DevTools Network → 1 個 `GET /api/drive/users/search?q=...&limit=10` 200
- dropdown row 顯 4-5 行（每個 user 一張 row）：avatar 首2字大寫 + account（大字）+ name（or「（未設定）」）+ email
- 連打 6 字 → debounce 後最終 1 個 fire（不會撞 backend throttle 60/min）

**Failure fallback**: dropdown 空但 user 確實存在 → check throttle / DB user table。

### 3.2 Phase 2B write share

ShareDialog AclForm 內：
- 選一個 user → 「權限」select 改「可編輯」 → 點「分享」 → 看到「✓ 已分享」 1.2s auto close

**Expected**:
- DevTools Network → 1 個 `POST /api/drive/shares` 201，body 含 `permission: "write"`

進 `/main/drive/shared/out` → ACL tab：
- 看到剛建的 share row
- permission column 是 `<select>` value="write"
- 改回 "read"
- **Expected**: 1 個 `PATCH /api/drive/shares/{id}` 200，body `{"permission": "read"}`，select 顯 "read"（樂觀 update 即時）

### 3.3 Phase 2B revoke cascade trace（folder share + grantee 創檔）

需兩個 user（owner + grantee）。 owner：
1. 建 folder + upload file 進去
2. 對 grantee 建 folder write share

切到 grantee 視角（hard reload + swap localStorage 三 keys，見 §3.5）→ `/main/drive/folder/{shared_folder_id}` → upload 一個 file。

切回 owner 視角 → `/main/drive/shared/out` ACL tab → 點剛建 folder share「撤銷」按鈕：
- ConfirmDialog 顯：「撤銷對「{grantee}」分享的資料夾「{folder}」？\n注意：對方在此資料夾內建立的檔案會移動到其根目錄（仍歸對方所有）。」
- 點「撤銷」 → 黃色 banner trace 「已撤銷分享 — 對方先前在資料夾內建立的 1 個檔案已移到對方根目錄」

**Expected**: `DELETE /api/drive/shares/{id}` 200，response body 含 `moved_files: 1`。
切 grantee 視角 verify file 出現在 grantee root。

### 3.4 Phase 2C borrowed UI disable

切 grantee 視角（見 §3.5），對 owner 分享給 grantee 的 file/folder：

**Read share file**:
- ContextMenu 右鍵 → `重新命名 / 移動到… / 刪除 / 分享` 全 disabled (灰色 + tooltip「此檔案唯讀」/「只能由擁有者分享」)
- `開啟 / 下載` 仍 enabled

**Write share file**:
- ContextMenu `重新命名 / 移動到… / 刪除` enabled
- `分享` disabled (tooltip「只能由擁有者分享」)

**Read share folder**:
- ContextMenu `重新命名 / 移動到… / 刪除 / 分享` 全 disabled (tooltip「此資料夾唯讀」/「只能由擁有者分享」)

**Write share folder**:
- ContextMenu `重新命名 / 移動到… / 刪除` disabled (tooltip「資料夾本身需擁有者修改」)
- 點 folder 進入 → 內部 file 可 upload / rename / delete (per finding A by design)

### 3.5 grantee perspective swap (manual)

DevTools Console（**owner already logged in** 後執行）：

```js
// 假設你已從 ephemeral user create response 拿到 token + user object
const granteeToken = "<JWT_FROM_EPHEMERAL_CREATE>";
const granteeUser = { id: 43, account: "e2e_ephemeral_xxx", name: "...", email: "...", avatar_url: null };

localStorage.setItem('token', granteeToken);
localStorage.setItem('user', JSON.stringify(granteeUser));
localStorage.setItem('user_id', String(granteeUser.id));  // ← critical, App.tsx module 載入時讀

window.location.href = '/main/drive/shared/in';  // hard reload, 不是 SPA navigate
```

**critical 三 keys 都要 swap + hard reload module**。若只 swap token 沒 swap user_id，撞 module-const stale 401 cascade logout。

切回 owner: 先記下 owner 的 token / user / user_id，swap 後再 swap 回。

### 3.6 v?-zip folder share download

任一 user 建 folder + upload 幾個 file →
ShareDialog → 「建立公開連結」 tab →「建立連結」 → 拿 URL →

開無痕視窗（無 auth）→ 貼 URL → ShareLinkLandingPage 顯：
- 📁 icon + folder name
- 「下載（zip）」 button (黃色 primary style)
- 「下載為 zip 檔，含資料夾結構」 note

點按鈕 → 下載 `{foldername}.zip`，含結構保留。

**Expected**: `GET /api/p/{token}/download` 200 + `Content-Type: application/zip` + Content-Disposition attachment。

### 3.7 v3 video onError refresh

upload 一個 mp4 → 進 `/main/drive/file/{id}` → VideoPlayer 載入 8s 影片 → 等 5 分鐘（讓 sig 過期）→ 拖時間軸 / 按 play：

**Expected**: 自動 retry once → 新 sig 簽 → 影片繼續播。
**真實 verify**: DevTools Network →
1. 第一次 `POST /api/drive/files/{id}/stream-url` (mount)
2. 等 5 分鐘
3. 拖時間軸 → `<video>` onError → 第二次 `POST /api/drive/files/{id}/stream-url` (refresh)
4. 新 URL GET 206 partial content

連續 fail 第二次 → 「影片載入失敗，請手動重整或檢查網路」 persistent error。

---

## 4. Console / Network sanity

- DevTools Console: **zero error** 全程
  - 例外：avatar 圖 cross-origin 偶爾 net::ERR_ABORTED（圖載入 race），acceptable
- Network tab Filter `Failed/Slow`:
  - 不該有 4xx/5xx 對 `/api/drive/*` (除非 testing read-only borrowed click disabled button → 不該觸發 request)
- 連續搜尋 user 6 字 → backend `/users/search` 應 < 6 request（debounce work）

---

## 5. Rollback

撞問題：

```bash
# 5.1 stop new container
docker compose stop koatag-fontend

# 5.2 revert to previous image (用 §2.3 記的 IMAGE ID)
docker run -d --name koatag_fontend_rollback \
  --network koatag_koaTag-network \
  -p 3000:80 \
  <OLD_IMAGE_ID>

# 5.3 alternative: git revert + rebuild
git revert <bad_commit_hash>
git push github main
# 然後重跑 §2.2-2.5
```

回滾涉及 backend 配套 (v? 三 task 是 frontend+backend 並行 release):
- 若 frontend 回滾但 backend 沒回滾 → 不會壞既有 owned 流程，只是 v? features 用不到
- 若 backend 回滾但 frontend 沒回滾 → frontend 試打 v? endpoint 拿 404 / 422，UI 顯 error banner 但不擋 owned 流程

---

## 6. Post-deploy backend audit cross-check

frontend 看不到 audit log，但 koatag prod-side 應 grep verify 預期 audit events:

- `drive.share.create` （Phase 2B create share）
- `drive.share.permission_update` （Phase 2B edit）
- `drive.share.revoke_cascade_moved` （Phase 2B revoke cascade move > 0）
- audit `drive.users.search` (Phase 1)

若 audit log 沒 record，可能 backend env config / log writer 沒 wire — 跟 koatag 確認。

---

## 7. Known limitations

1. Phase 2C borrowed UI disable — `borrowedSharesStore` mount-time fetch + 不做實時同步。其他 user 對你新加/改/revoke share，你頁面要 reload 才看到變化。MVP 可接受。
2. workers:1 playwright config — 沒 flip parallel。e2e CI 整套 ~10 min 順跑。
3. video sig 5min 過期 race: VideoPlayer 自動 retry once；連續 fail 顯 persistent error。
4. Content-Disposition header 在 frontend JS 讀 null（CORS not exposed）；browser `<a download>` 仍會 take backend hint。
