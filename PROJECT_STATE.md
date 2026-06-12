# KOATAG-frontend — Live State

> 新 session 啟動先讀此 + `git status` + `git log -5`。
> 規則：close 一 round 就更新；過時直接覆寫不保歷史（live state ≠ archive）。
> 詳細 spec 看 `CLOUD_DRIVE_FRONTEND_SPEC.md` v1.7 / `CLOUD_DRIVE_SPEC.md` v1.2。

---

## In-flight（等動作）

**E2EE Round 3 — 7 步全 close + pushed**（多輪規劃協定 R3 dispatch round 收尾）。`feat/redesign-v3` HEAD == origin（`edfd2a9`，ahead 0，2026-06-11 push per wiki #1899 user Discord GO）：
- `b429452` R3 #1-6 frontend foundation（key hierarchy/KDF、AEAD encrypt+decrypt pipeline、share grant、download、4 stores、MasterKeyContext）— verify：tsc clean + jest 78/78。
- `edfd2a9` R3 #7 D.18 MIME trust model（encrypted era）— mimeCheck(file-type/core magic-byte)、pre-encrypt whitelist/polyglot gate、ciphertext {name,mime} payload、listFiles parse、UploadTrustDisclosure UI。verify：tsc + build + jest 82/82 + playwright §2.2.5。wiki ratify（#1892，4 catch 全收）。backend R3 #7 `09e4ef2` wiki 同步 push OHIMEOPP/koatag main。

**遺留（next round 候選，非 #7 scope）**：`useUploadScheduler` 仍走 plaintext `uploadFile`，encrypt 路徑(`uploadFileSmart`)尚未接進 UI scheduler；detectedMime/ciphertext payload 已 ready，等 scheduler cutover step。

**E2EE Round 4（救援改密碼 + id=1,2 遷移）— ✅ LANDED + live e2e 成功 + pushed**（2026-06-12）。spec doc `life_wiki/.../koatag-e2ee-round4-rescue-2026-06-12.md`。scope 極小（縮自原 #8，BIP39 整套 DROP）。
- **id=1 cool901215 改密碼 live 成功、資料 100% 無損**（backend post-change 讀回：master_pubkey 不變 / salt 換新 / privkey re-wrap / 13 檔 168 folder 未動）。id=2 KUROMU = user 選擇留 e2ee12345 不改。
- frontend commit 鏈（全 push `feat/redesign-v3` HEAD=`06f9b8b`）：`9d20ad8`(change-password UI+gate) → `253231d`(login 送 raw password + KDF **p=1** 對齊 enroll) → `4e6591e`(**解法 A**：forced 改密碼頁 inline 渲染在 Login，不 reload→保住 in-memory privkey、附帶無 sidebar=forced-lock 內建) → `5ab0d12`+`06f9b8b`(route /auth/ thrash pair，net=no-/auth/)。
- deployed bundle `main.5cc072ce.js`（容器 cp）。change-password 路徑 = **`/api/change-password*`（NO /auth/）**，跟 backend `a7ebb8b` 鎖死對齊。
- changePasswordFlow body 5 欄 frozen（#2015）：`{ new_password(raw→bcrypt), new_auth_password_hash(base64 raw 32B), new_auth_kdf_salt, new_master_key_kdf_salt, new_master_privkey_wrap_by_master_key }`；success `{status:'ok'}`。
- **本輪 7 層 latent bug（真人 E2EE login 史上第一次跑）全清**：①stale-log 誤判 ②login 缺 raw password(bcrypt) ③KDF p=2→p=1 對齊 libsodium enroll ④login response 缺 master_pubkey+wrap(序列化) ⑤forced 導頁 reload 洗 in-memory privkey(→解法 A inline) ⑥change-password path 缺前綴 ⑦兩 agent route /auth/ thrash（freeze no-/auth/ 收斂）。
- backlog（非本輪，wiki 記）：(a) register `auth_password_hash` PHC preg vs 前端 base64 不相容（同源 latent）(b) normal /main login 也 full-reload 洗 privkey → 全 app navigate()+App gate render-time 保 privkey（latent，drive 多 plaintext）(c) route convention 統一（login 無 /auth/ vs change-password 無 /auth/ 現已一致；cosmetic）。

D.19 frontend ship done（commit `f72fa04` + 容器 cp `main.d625f217.js`）。

## Live in prod-like container

`koatag_fontend` (docker, port 3000) serving **`main.5cc072ce.js`** / `main.4e660bde.css` — 2026-06-12 cp（E2EE R3 #1-7 foundation + R4 救援改密碼）。內含累積（D.x plaintext era + E2EE）：
- D.1 A+B+C share / video onError / v?-zip landing
- D.9 v3 Trash UI scaffold
- D.12 上傳 2GB / 配額 20GB
- D.14 / D.14b createFolder UI（toolbar + empty area context menu）
- D.16 2GB upload UX hardening（throttle / retry max 3 / ETA / speed）
- D.17 image / tag / pageInfo service URL `{user_id}` 拔除（IDOR fix 真實 land）
- D.18 frontend optional UX（`e12c93a` — accept narrow + pre-validate + 415 message）
- 4 CSS class polish（`137fdbf` — trash-hint / -warn / -pager + -destructive typo 對齊）
- D.19 圖庫上傳 50MB/10筆/500MB 限制（`f72fa04` — Math.min(app, php ini) + backend 400/413 catch）
- Sidebar 雲端硬碟 section 從媒體分出

D.6 video poster frame 純 backend `thumb_path` 寫入，前端透明消費（wiki #659：5/15 13:50 起 container live，mp4 smoke pass `Lavc61.19.101`）。

## Working tree

乾淨（唯一 untracked = 既有 stray `phase3-smoke-login-cors-blocked.png`，非本輪產物，不 commit）。R3 #1-6 + #7 已 local commit、**未 push**。

## 待 user 動作

無強制 action。R3 #1-6 + #7 local commits 未 push（等 wiki review / round close 再決定 push）。等 wiki #1891 reply（scheduler cutover + self-catch ratify）。

## 功能 backlog — E2EE 相關性三色分類（per wiki #568）

### ⚪ E2EE 不相關 — 可單獨做不浪費
- ✅ 4 CSS class polish — done（trash-hint / -warn / -pager 三條從未寫；-danger className typo 同步修為 -destructive；commit `137fdbf`，bundle `main.70b1a2aa.js` / `main.acc32769.css` +104B；待 user container cp）
- ✅ D.17 Image endpoint URL hygiene（2026-05-15 三方 close per wiki #576）— done
- ✅ D.18 Image upload MIME validation — 整段 done（backend `1ef4dbf` whitelist + fileinfo magic-byte security gate；frontend `e12c93a` 3 optionals UX；三方 close per wiki #659）

### 🟡 Co-design opportunity — E2EE round 一起更省
- v? 2GB upload UX hardening（D.16 已 land throttle/retry/ETA，剩 chunked resume 連 E2EE resume token + key derivation 一起 design）— Round 2 #3 upload pipeline
- v? tus chunked upload UI 對應（>2GB 用例；chunk-encrypt 順序前端串接）— Round 2 #3
- v? D.9 cascade share rebuild UI（E2EE share = key 共享 → UI 流程跟現行純 ACL revoke 不一樣）— Round 2 #4 share flow

### 🔴 等 E2EE 一起 design — stand-alone 會白工
- v? Folder trash cascade UI（cascade semantic 跟 key forget batch 對齊）— Round 2 #4 share flow
- v4 HLS player UI — server-side transcode 對 ciphertext 不可能 → Round 2 #7 streaming decrypt 或 defer round N
- v4 FTS 全文搜尋 UI — server-side index 跟 E2EE 矛盾 → defer round N

### 🟣 E2EE Round 1 額外列入 Round 2 housekeeping batch（#9）
- inline style CSP cleanup（既有 Dropzone `style={{...}}` 一堆要轉 className 才好設 strict CSP）
- e2e suite 整套重寫（既有 `tests/e2e/drive.*.spec.ts` plaintext flow assumption）
- EXIF PII redact（圖庫留 plaintext 仍 leak GPS / 機器型號）

## Active backlog（next round 候選）

⚪ 段全清完，🟡 / 🔴 / 🟣 段全列入 E2EE Round 2 9-step（仲裁見 wiki output `koatag-e2ee-alignment-2026-05-17.md` §3.5）。等 user Discord DM 後 Round 2 dispatch。

## 三方 status snapshot

- contract `CLOUD_DRIVE_SPEC.md`：v1.2（committed 5012f2e + wiki D.12 patches in 5893232）
- backend spec：實質 v1.5+（wiki 主導；D.17 cross-ref 已 patch）
- frontend spec `CLOUD_DRIVE_FRONTEND_SPEC.md`：v1.7（D.17 spec patch committed a76c490）
- 最後 mailbox round close：E2EE R1 frontend catalogue（wiki #716 — `koatag-e2ee-alignment-2026-05-17.md` §2.1-2.8 fill 完，跟 backend §1 cross-ref 對齊度高）
- 當前 in-flight：等 user Discord DM review + Round 2 dispatch（backend-led #1 Key hierarchy；frontend 可平行 mock client 待 user GO）

## Recent commits (this session)

```
edfd2a9 feat(drive): R3 #7 D.18 MIME trust model (encrypted era) — frontend
b429452 feat(e2ee): R3 #1-6 frontend foundation — key hierarchy, AEAD pipeline, share, download
f72fa04 feat(image): D.19 圖庫上傳 50MB/10筆/500MB 限制
438bc3a docs: PROJECT_STATE.md sync — container cp per wiki #685
9a98fb2 docs: PROJECT_STATE.md sync — 4 CSS class polish close per wiki #674
137fdbf feat(drive): trash UI 4 CSS class polish
4b7253b docs: PROJECT_STATE.md sync — D.18 + D.6 三方 close per wiki #659
e12c93a feat(image): D.18 frontend MIME 3 optionals — accept narrow + pre-validate + 415 message
c8fb69c docs: PROJECT_STATE.md sync — D.16/D.17 round close + D.18 backlog entry
a76c490 feat(image/tag): D.17 service URL hygiene — remove user_id path param
f66bcbe feat(drive): D.16 2GB upload UX hardening
```

## Mailbox quick-lookup（this session 重要 thread）

- #469 / #484 / #485 — D.1 dispatch 演進
- #491 — scope_discipline lesson（e2e over-scope）
- #499 / #501 / #503 / #506 / #508 — D.9 dispatch + pace + close + cascade caveat
- #521 / #527 / #531 / #537 — spec drift cleanup + PROJECT_STATE + CLAUDE.md + batch commit dispatch
- #541 / #543 / #546 / #547 — D.12 配額/上傳 dispatch + commit + deploy + close
- #549 / #550 / #551 — D.13 folder smoke finding + UI gap report + D.14 dispatch
- #552 / #553 / #554 / #555 / #556 — D.14 + D.14b commit / deploy / playwright verify / close chain
