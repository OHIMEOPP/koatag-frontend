# KOATAG-frontend — Live State

> 新 session 啟動先讀此 + `git status` + `git log -5`。
> 規則：close 一 round 就更新；過時直接覆寫不保歷史（live state ≠ archive）。
> 詳細 spec 看 `CLOUD_DRIVE_FRONTEND_SPEC.md` v1.2 / `CLOUD_DRIVE_SPEC.md` v1.2。

---

## In-flight（等動作）

- **D.9 v3 Trash UI scaffold** — Phase A-E 全完，working tree dirty 待 user 批 commit
  - mailbox round close（wiki #508 三層 check pass，cascade caveat 已 patch）
  - 等 backend #498 endpoint up（前端 graceful 404 接住）
  - Browser smoke 6 case 待 user morning 跟 D.6 一起跑
  - 4 CSS class 沒 declaration（`drive-trash-hint` / `-warn` / `-pager` / `drive-modal-btn-danger`）— 視覺待 polish round

## Live in prod-like container

`koatag_fontend` (docker, port 3000) serving `main.9a59f655.js` — D.1 frontend prod deploy 2026-05-15 00:41 GMT 完成（docker cp host npm build → nginx `/usr/share/nginx/html/`）。

如要部署 D.9 + D.6 新功能：rebuild + docker cp 同流程（per `DEPLOY_CHECKLIST_FRONTEND.md` §2 + wiki #485 (b) 快路徑）。

## Working tree dirty

```
 M src/components/Sidebar.tsx              (D.9: 垃圾桶 entry)
 M src/pages/drive/DrivePage.tsx           (D.9: trash route)
 M src/services/drive.errorMap.tsx         (D.9: 2 codes)
 M src/services/drive.service.tsx          (D.9: TrashedFile + 3 funcs)
?? src/pages/drive/TrashPage.tsx           (D.9: new)
?? src/stores/trashStore.tsx               (D.9: new)
```

加上一堆 `??` screenshot PNG（歷次 playwright failure 留底，不必 commit）。

## 待 user morning 決定

1. D.9 + D.2-already-committed 合一 commit 還是分開
2. D.9 + D.6 都 deploy 後 browser smoke 6 case + 4 case 一次驗
3. D.10 Breadcrumb 截斷如果 backend 有 frontend 連帶 UI → 等 wiki 派工
4. 4 CSS class 視覺 polish 是否要 morning 一併（看哪個 design 來源）

## 結構性 backlog（不在 spec §15.2，等 user 提）

- v3 Image URL hygiene 拔 `{user_id}`（跨 image module 1-2 天 effort）
- v? Storage GC cron（destructive，user oversight 需要）
- v? Folder trash cascade restore / hard delete
- D.11 backend zip OOM 10k+ folder — frontend 不需動

## 三方 status snapshot

- contract `CLOUD_DRIVE_SPEC.md`：v1.2（已 committed 5012f2e）
- backend spec：實質 v1.5（wiki 主導）
- frontend spec：v1.2（已 committed 5012f2e）
- mailbox 最後 id：~527 範圍

## Mailbox quick-lookup（current round 重要 thread）

- #469 / #484 / #485 — D.1 dispatch 演進
- #486 — D.1 frontend deploy 完成回報
- #491 — scope_discipline lesson（e2e over-scope）
- #499 / #501 / #503 — D.9 dispatch + pace 校準
- #506 / #508 — D.9 scaffold close + cascade caveat
- #521 / #527 — spec drift cleanup + PROJECT_STATE 提案
