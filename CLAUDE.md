# KOATAG Frontend (React + TS + CRA + Docker) — Project Instructions

工作目錄：`C:\Users\User\Desktop\VSCcode\KOATAG-frontend\koatag-frontend\`

## Session startup

1. Read `PROJECT_STATE.md` — live state board（in-flight / dirty / 待 user 動作 / backlog）
2. Read `CLOUD_DRIVE_FRONTEND_SPEC.md` + `CLOUD_DRIVE_SPEC.md`（contract）— design source of truth
3. Read memory `MEMORY.md`（auto-loaded）— pattern / protocol / 過往 lesson

## State board rule

每 close 一輪 round 或 ship feature，更新 `PROJECT_STATE.md`。過時 entry 直接覆寫不留歷史（live state ≠ archive）。

## Frontend-specific 注意

- **baseURL 已含 `/api`**（`.env` `REACT_APP_API_URL=http://koatag.com:8123/api`），service 路徑寫 `/drive/*` **不** 寫 `/api/drive/*`
- Build：CRA `react-scripts`（非 Vite）。`npm run build` → `build/`；container 內 nginx 服 `/usr/share/nginx/html/`
- Dev：`npm start` host dev server :3000；prod-like docker container `koatag_fontend` 同 port 3000（取代彼此）
- TS check：`npx tsc --noEmit -p tsconfig.json`
- Playwright e2e：`npm run e2e` 需 backend `APP_E2E_ENABLED=true`（prod 預設 false，e2e 跑不動是 by design — 參 `feedback_scope_discipline`）
