# KOATAG-frontend — Live State

> 新 session 啟動先讀此 + `git status` + `git log -5`。
> 規則：close 一 round 就更新；過時直接覆寫不保歷史（live state ≠ archive）。
> 詳細 spec 看 `CLOUD_DRIVE_FRONTEND_SPEC.md` v1.3 / `CLOUD_DRIVE_SPEC.md` v1.2。

---

## In-flight（等動作）

無 active dispatch — D.1 / D.6 / D.9 / D.12 round 三方 close（per wiki #547）。等 user 跑 browser smoke 或下個 round。

## Live in prod-like container

`koatag_fontend` (docker, port 3000) serving `main.a4eed5cc.js` — 2026-05-15 02:54 GMT cp。內含 D.1（A+B+C share/video/zip）+ D.9 Trash scaffold + D.12 上傳 2GB / 配額 20GB。

D.6 video poster frame 是純 backend `thumb_path` 寫入，前端既有 consumer 透明 render，無 frontend code change。

## Working tree dirty

```
 D DESIGN_SYSTEM.md      （早期 refactor 殘留，待 user 決定 separate commit 刪除）
 D WEBSITE_FEATURES.md   （同上）
?? *.png                  （17 個 playwright failure screenshot，不入 source control）
```

工作 src/ 樹乾淨。spec 樹乾淨。

## 待 user 動作

1. **Browser smoke**：開 `http://localhost:3000/` → Ctrl+Shift+R → DevTools Network verify `main.a4eed5cc.js` → 跑 15+ case
   - D.1 7 case（§3.1-§3.7 share/video/zip）
   - D.9 6 case（trash list / restore / permanent delete / empty / pagination / 7-day warn）
   - D.12 2 case（1.5GB upload success / 2.5GB upload client-reject）
2. **2 D 殘留檔**（DESIGN_SYSTEM.md / WEBSITE_FEATURES.md）：要 commit 刪除嗎？還是 restore？
3. **PNGs 17 個**：要清還是留底？

任 browser smoke fail 寄 mailbox debug。

## 結構性 backlog（不在 spec §15.2，等 user 提）

- v3 Image URL hygiene 拔 `{user_id}`（跨 image module 1-2 天 effort）
- v? Storage GC cron（destructive，user oversight 需要）
- v? Folder trash cascade restore / hard delete
- v? tus chunked upload（>2GB 用例；D.12 後 50MB 硬拒解禁）
- v? 2GB upload UX hardening（progress 順 / retry / 中斷恢復 — caveats per wiki #541 ack）
- D.11 backend zip OOM 10k+ folder — frontend 不需動
- 4 CSS class polish（`drive-trash-hint` / `-warn` / `-pager` / `drive-modal-btn-danger`）

## 三方 status snapshot

- contract `CLOUD_DRIVE_SPEC.md`：v1.2（wiki D.12 patches committed 5893232）
- backend spec：實質 v1.5（wiki 主導）
- frontend spec `CLOUD_DRIVE_FRONTEND_SPEC.md`：v1.3（D.9 + D.12 entries committed 9337354 + 5893232）
- 最後 mailbox round close：D.12（wiki #547 ack）

## Recent commits (this session)

```
5893232 feat(drive): D.12 single-file upload 50MB->2GB + quota 5GB->20GB
9337354 feat(drive): D.9 v3 Trash UI scaffold + startup pattern + state board
5012f2e docs(drive): CLOUD_DRIVE spec v1.2 + frontend spec v1.2（D.2 spec drift close）
f387203 test(drive): S4/S5 spec stale fix per wiki #424
```

## Mailbox quick-lookup（this session 重要 thread）

- #469 / #484 / #485 — D.1 dispatch 演進
- #491 — scope_discipline lesson（e2e over-scope）
- #499 / #501 / #503 / #506 / #508 — D.9 dispatch + pace + close + cascade caveat
- #521 / #527 / #531 / #537 — spec drift cleanup + PROJECT_STATE + CLAUDE.md + batch commit dispatch
- #541 / #543 / #546 / #547 — D.12 配額/上傳 dispatch + commit + deploy + close
