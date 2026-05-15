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

## Medium tier backlog（wiki #556 候選）

並行 autonomous-safe 的兩條（前後端 isolated）：
- **Zip OOM generator pattern**（backend solo）— 10k+ folder zip 改 streaming generator
- **2GB upload UX hardening**（frontend solo）— progress bar 順暢驗證 / retry / 中斷恢復選項（per wiki #541 acked caveats）

Sequential（前後端 cascade 設計）：
- **Folder trash + cascade restore**（v? 留 backlog，1.5 天 effort）

決定權在 user — 並行或 sequential 啟動 next round。

## 結構性 backlog（先 user 提）

- v3 Image URL hygiene 拔 `{user_id}`（跨 image module 1-2 天 effort）
- v? Storage GC cron（destructive，user oversight 需要）
- v? tus chunked upload（>2GB 用例）
- D.11 backend zip OOM — 同 Medium tier 第一條
- 4 CSS class polish（`drive-trash-hint` / `-warn` / `-pager` / `drive-modal-btn-danger`）

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
