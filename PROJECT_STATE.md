# KOATAG-frontend — Live State

> 新 session 啟動先讀此 + `git status` + `git log -5`。
> 規則：close 一 round 就更新；過時直接覆寫不保歷史（live state ≠ archive）。
> 詳細 spec 看 `CLOUD_DRIVE_FRONTEND_SPEC.md` v1.7 / `CLOUD_DRIVE_SPEC.md` v1.2。

---

## In-flight（等動作）

E2EE Round 1 frontend catalogue 已 land + close（per wiki #703/#704 dispatch → #712 fill → #715 ack → #716 close ack）。等 user Discord DM review 後 Round 2 dispatch（backend-led #1 Key hierarchy + KDF pipeline 起；frontend 可平行起 mock client prototype 但等 user GO 不擅動）。

D.19 frontend ship done（commit `f72fa04` + 容器 cp `main.d625f217.js`）。

## Live in prod-like container

`koatag_fontend` (docker, port 3000) serving `main.d625f217.js` / `main.acc32769.css` — 2026-05-16 cp（per wiki #690 D.19）。內含累積：
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

完全乾淨。

## 待 user 動作

無強制 action — system 全 in-sync 狀態。
optional：跑 manual browser smoke（D.1 7 / D.9 6 / D.12 2 / D.14 2 / D.14b 3 case）。

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
