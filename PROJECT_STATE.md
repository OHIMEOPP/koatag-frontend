# KOATAG-frontend — Live State

> 新 session 啟動先讀此 + `git status` + `git log -5`。
> 規則：close 一 round 就更新；過時直接覆寫不保歷史（live state ≠ archive）。
> 詳細 spec 看 `CLOUD_DRIVE_FRONTEND_SPEC.md` v1.5 / `CLOUD_DRIVE_SPEC.md` v1.2。

---

## In-flight（等動作）

無 active dispatch — D.13 / D.14 / D.14b 補做 chain 三方 close（per wiki #556）。等 user 跑 browser smoke 或下個 round dispatch（Medium tier backlog 之一）。

## Live in prod-like container

`koatag_fontend` (docker, port 3000) serving `main.bd8811e5.js` — 2026-05-15 06:08 GMT cp。內含累積：
- D.1 A+B+C share / video onError / v?-zip landing
- D.9 v3 Trash UI scaffold
- D.12 上傳 2GB / 配額 20GB
- D.14 createFolder UI affordance（toolbar button）
- D.14b empty area right-click context menu
- Sidebar 雲端硬碟 section 從媒體分出（commit `44fb676`）

D.6 video poster frame 純 backend `thumb_path` 寫入，前端透明消費。

## Working tree

完全乾淨。

## 待 user 動作

無強制 action — system 全 in-sync 狀態。
optional：跑 manual browser smoke（D.1 7 / D.9 6 / D.12 2 / D.14 2 / D.14b 3 case）。

## 功能 backlog — E2EE 相關性三色分類（per wiki #568）

### ⚪ E2EE 不相關 — 可單獨做不浪費
- v3 Image endpoint `{user_id}` 拔除 URL hygiene（跨 image module 1-2 天 effort）
- 4 CSS class polish（`drive-trash-hint` / `-warn` / `-pager` / `drive-modal-btn-danger`）

### 🟡 Co-design opportunity — E2EE round 一起更省
- v? 2GB upload UX hardening（D.16 已 land throttle/retry/ETA，剩 chunked resume 連 E2EE resume token + key derivation 一起 design）
- v? tus chunked upload UI 對應（>2GB 用例；chunk-encrypt 順序前端串接）
- v? D.9 cascade share rebuild UI（E2EE share = key 共享 → UI 流程跟現行純 ACL revoke 不一樣）

### 🔴 等 E2EE 一起 design — stand-alone 會白工
- v? Folder trash cascade UI（cascade semantic 跟 key forget batch 對齊）
- v4 HLS player UI — server-side transcode 對 ciphertext 不可能
- v4 FTS 全文搜尋 UI — server-side index 跟 E2EE 矛盾

## Active backlog（next round 候選）

⚪ 段兩條（Image URL hygiene / CSS polish），等 user 排或 wiki dispatch。  
🟡 / 🔴 段 6 條視作「E2EE-aware deferrals」，未來 E2EE design round 一併 review。

## 三方 status snapshot

- contract `CLOUD_DRIVE_SPEC.md`：v1.2（committed 5012f2e + wiki D.12 patches in 5893232）
- backend spec：實質 v1.5（wiki 主導）
- frontend spec `CLOUD_DRIVE_FRONTEND_SPEC.md`：v1.5（D.14b spec patch committed dd958e1）
- 最後 mailbox round close：D.14b（wiki #556 ack）

## Recent commits (this session)

```
dd958e1 feat(drive): D.14b empty area right-click context menu
44fb676 feat(sidebar): split 雲端硬碟 section out from 媒體
d1736e3 chore: remove stale DESIGN_SYSTEM.md + WEBSITE_FEATURES.md
b96de6b feat(drive): D.14 createFolder UI affordance — fix D.13 playwright gap
5d3329b docs: PROJECT_STATE.md sync — D.1/D.6/D.9/D.12 round close
5893232 feat(drive): D.12 single-file upload 50MB->2GB + quota 5GB->20GB
9337354 feat(drive): D.9 v3 Trash UI scaffold + startup pattern + state board
```

## Mailbox quick-lookup（this session 重要 thread）

- #469 / #484 / #485 — D.1 dispatch 演進
- #491 — scope_discipline lesson（e2e over-scope）
- #499 / #501 / #503 / #506 / #508 — D.9 dispatch + pace + close + cascade caveat
- #521 / #527 / #531 / #537 — spec drift cleanup + PROJECT_STATE + CLAUDE.md + batch commit dispatch
- #541 / #543 / #546 / #547 — D.12 配額/上傳 dispatch + commit + deploy + close
- #549 / #550 / #551 — D.13 folder smoke finding + UI gap report + D.14 dispatch
- #552 / #553 / #554 / #555 / #556 — D.14 + D.14b commit / deploy / playwright verify / close chain
