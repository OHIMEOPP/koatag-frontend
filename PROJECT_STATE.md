# KOATAG-frontend — Live State

> 新 session 啟動先讀此 + `git status` + `git log -5`。
> 規則：close 一 round 就更新；過時直接覆寫不保歷史（live state ≠ archive）。
> 詳細 spec 看 `CLOUD_DRIVE_FRONTEND_SPEC.md` v1.7 / `CLOUD_DRIVE_SPEC.md` v1.2。

---

## In-flight（等動作）

**Security MIME-gate 修復（D.18/R3#7 client gate 形同虛設）— ✅ LANDED + push + 部署 live + browser 三項 verify 全綠 + wiki #2237 CLOSE**（2026-06-13）：
- **背景**：P0 smoke 揪到 console `[mimeCheck] classify failed: Buffer is not defined` → CRA/webpack5 拔 Node `Buffer` global，file-type@16 magic 解析引用 Buffer 即 throw → classify reject → 靜默 fail-open。enforce=true 後，加密路徑 server 結構上不驗內容（`DriveFileController:151` `$runServerMagic=!isEncrypted`、`:256` 對密文無 verify means）→ **這道 client gate 是內容型 MIME/polyglot 唯一防線，卻從沒在 browser 跑過**。
- **修法**（commit `f497fc9`）：Fix1 `import {Buffer} from "buffer"`(6.0.3 直接 dep)+ guard shim 不覆寫 Node 原生（jest 不受影響）；Fix2 catch 從「無 gate enqueue」改 `rejectCode:'MIME_CHECK_FAILED'`（fail-open→**fail-closed**）；errorMap +1 + test +4（含 fail-closed 斷言）。6 檔 100+/7-。
- **部署 live**：bundle **`main.a15d2fbc.js`** 已 `docker cp` 進 `koatag_fontend`（md5 `aeaef2f8…` 容器==本地 build 一致、index.html 指向、mtime 18:17）。**已 push**（origin==HEAD==`f497fc9`，0/0）。
- **browser 三項 verify 全綠**（localhost:3000 容器 live bundle + 真人 cool901215）：①正常 64×64 PNG→gate accept→`POST /drive/files 201`(id242)→blob 解密縮圖 64×64 ②偽裝檔（MZ 執行檔頭偽裝 .png）→偵測 `application/x-msdownload` 不在白名單→「不支援的檔案類型，已略過/1 失敗」+ **network 無 POST**（真沒上傳，非只看 UI）+ grid 無→**gate 真跑 + fail-closed 雙證實** ③明文 grandfather(http signed) 與加密(blob) per-file branch 並存零變動。console 0 warning（`[mimeCheck] classify failed` 消失）。測試檔 id242 已永久刪、本地 fixture 清。
- wiki #2237 獨立驗（push 0/0 + build md5==容器 md5 + browser 方法論認可）→ **CLOSE**。**旁註**：grid 殘留 `.tmp_smoke.mp4`/`sample.mp4`（非本輪、非我上傳）wiki 指示先不動，之後 dev residue sweep 一起掃。

**E2EE enforce flag live 後續 — P0 inline 顯示接加密解密 — ✅ LANDED + 部署 live + 真人 5 項 smoke 全綠；wiki #2231 已 close**（2026-06-13）：
- **背景**：koatag 翻 `DRIVE_ENFORCE_ENCRYPTED_UPLOAD=true` 並 push live（#2226）→ 所有新上傳一律加密。user 撞到「上傳圖只看到檔名、內容空白」（wiki #2227 P0）。根因 = 4 個顯示元件（FileCard 縮圖 / ImagePreview / ImageFullscreen / VideoPlayer）仍把 raw signed URL（密文/409）餵 `<img>/<video>`，顯示層從沒接解密。
- **修法**：抽共用 hook `useDecryptedAssetUrl(file, kind)` — 明文走既有 signed URL（零行為變動）；加密走 `downloadEncryptedFile`→`decryptedAssetStore` LRU→object URL。thumb/full 統一 cache 在單一 `full` key（清單+詳情+全螢幕共用一次解密）。影片加密檔走整檔解密→blob→`<video>` degrade（MSE streaming 留 polish）。
- **commit `ffb0c70`** on feat/redesign-v3（hook+test+4 元件，263+/21-）。**未 push**（push 時機聽 wiki）。
- **部署 live**：bundle **`main.5ab4f12d.js`** `docker cp` 進 `koatag_fontend`（user 本 CLI 直接授權）。
- **真人 smoke 全綠**（cool901215 localhost:3000）：①加密圖清單縮圖 blob naturalW=640 吻合 ②詳情頁預覽 ③全螢幕 ④明文 grandfather 同 grid 並存 http(signed)+blob(decrypt) per-file branch 正確 ⑤加密影片 blob readyState=4 duration=5.06s。console 0 error。test 殘留全清（2 test 檔永久刪除）。wiki #2230 附 4 截圖待 close。
- **⚠️ 另案 latent bug（非本 P0 scope，丟 wiki triage）**：console warning `[mimeCheck] classify failed: Buffer is not defined`（file-type fromBuffer）→ D.18/R3#7 上傳前 MIME polyglot/whitelist 安全 gate 在 browser 實際沒跑（缺 Buffer polyfill，fallback 直接放行）。security-relevant，建議獨立排一輪。
- **polish backlog（wiki #2229 非 blocker #2）**：加密圖無伺服器縮圖，清單 grid mount 即每張整檔下載+解密（無 viewport gating）。50 張圖資料夾 = 開即 ~50 次整檔解密。正解 = upload 時生 client-encrypted thumbnail（小圖）。
- ───── 以下為前序 cutover history（可摺疊）─────

**E2EE Round 2 #4 — Upload Cutover + 名稱加密 + force-re-login gate + download 解密 wiring + chunked 契約（多輪規劃協定 R3 impl）— ✅ FE LANDED + STEP 1 bundle LIVE + STEP 2 smoke 全綠 + STEP 3 koatag 翻 enforce flag live（#2226）**（2026-06-13）：
- **STEP 1 DONE**：bundle `main.f50ca41e.js` 已 `docker cp` 進 `koatag_fontend` 容器（user CLI 直接授權「部署」；harness prod-touching gate 要 user 本 session 直接授權、wiki relay 不夠）。
- **STEP 2 smoke 全綠（prod bundle localhost:3000 真實 origin）**：①chunked ≥50MB roundtrip **byte-equal**（initiate 201 + 12 chunk PUT 200 + finalize 201 + download sha256 match）②single-blob roundtrip byte-equal ③加密 folder create 解密 ④明文 grandfather download 真 JPEG。test 殘留全清。
- **chunked Path C 第一次真跑揪 2 契約 bug（commit `a7eaa57`）**：initiate `total_size_plaintext`→`total_size_ciphertext`（422 INVALID_TOTAL_SIZE）+ response 讀 `session_id`→`upload_session_id`（undefined session）。wiki BE grep 確認只此 2 處 drift、chunk PUT/finalize 已對齊。
- **commit 鏈 feat/redesign-v3（未 push，push 等 wiki）**：fa6b615 / e98756c / ff39f3c / 461d499 / a7eaa57 + docs。
- **下一步 = STEP 3** `DRIVE_ENFORCE_ENCRYPTED_UPLOAD=true`（BE/koatag 端 + user 在 koatag CLI 授權）→ STEP 4 verify（FE 配合）。minor backlog：exact-5MB-multiple 檔 total_chunks 多算 1 空 chunk（功能正確，可後 polish）。
- ───── 以下為達成過程 history（可摺疊）─────
- spec 4 份（`life_wiki/.../koatag-e2ee-round2-{fe-cutover,folder-name,enforce-safety,...}-2026-06-13.md`）。FE 4 commit on `feat/redesign-v3`（未 push，push 等 wiki 協調）：
  - `fa6b615` scheduler→uploadFileSmart + encrypt phase UI（「加密中…」）+ errorMap（KEYS_MISSING/PLAINTEXT_UPLOAD_DISABLED）
  - `e98756c` folder/file 名加密（createFolder + renameOrMove `_applyRenameName`：file 重建 {name,mime} payload **mime 包回**、folder 裸 name、legacy 明文不 upgrade、key_wrap 複用）+ uploadFileSmart `!masterPubkey` throw KEYS_MISSING（forcePlaintext 移除）+ 8 tests
  - `ff39f3c` RequireKeys gate（Drive 邊界 inline re-derive modal）+ **login.tsx navigate 不 reload + App.tsx token reactive**（backlog b — 金鑰登入後存活）
  - `461d499` **download 解密 wiring**（user 解除 B0 download exclusion）：downloadFileSmart dispatcher（明文→window.open / 加密→decrypt+saveBlob）+ DrivePage/DriveFilePage 兩 call-site rewire + drive.download.ts 對齊真實 manifest schema（index/iv/hash/url）+ single-blob(Path B, decryptBlob AAD=null) / chunked(Path C) 雙路徑 + errorMap 4-layer fail codes
- **verify FE 全綠**（真實 login cool901215，dev-server proxy 繞 CORS — prod backend CORS 拒 localhost origin）：tsc/jest 90/90/build；登入→Drive 金鑰存活無 gate；F5→gate→inline re-derive→放行；logout→/login 無 loop；**加密 upload roundtrip 201+is_encrypted+解密**（BE `6906952` 修後）；**加密 download roundtrip byte-equal**（context-menu + 詳情頁兩 call-site，解密內容==原檔+檔名解密）；明文 download regression（真 JPEG）。
- 連帶修的 latent bug（cutover 真跑才爆，非不驗不知）：①BE upload Path B `DriveFileController:115` 無條件讀 `file`（FE `binary` spec-correct，BE `6906952` 修）②download UI 從沒接解密（兩 call-site 走 raw 路徑撞 409 USE_CHUNK_MANIFEST）③drive.download manifest schema 與真實 backend drift（dead code 從沒跑）。
- **STEP 1 bundle live：等 wiki cross-check verify → signal**（user 部署 GO 已在 Discord #2191/#2203）。序：wiki signal → 我 container swap（bundle live）→ BE STEP 2 smoke → STEP 3 翻 enforce flag（兩 prod-touching 各需 user GO）。**未 push**（push 時機 wiki 協調）。
- chunked(Path C) download 已對齊 schema 但**無 chunked fixture 未現驗**（標記）。test residue 已全清（folder + file id=234 + dev proxy config 還原）。

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

`koatag_fontend` (docker, port 3000) serving **`main.a15d2fbc.js`** / `main.6e8248fd.css` — 2026-06-13 cp（E2EE R2#4 cutover full + enforce flag live + P0 inline 顯示解密 + **security MIME-gate 修復 Buffer polyfill/fail-closed**）。內含累積（D.x plaintext era + E2EE）：
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
