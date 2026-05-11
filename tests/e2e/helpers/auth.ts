import { Page } from "@playwright/test";
import axios from "axios";

const API_BASE = process.env.E2E_API_BASE || "http://koatag.com:8123/api";

interface LoginResp {
  ok?: boolean;
  data?: { token?: string; user?: { id: number; account: string } };
  // legacy shape if backend returns flat
  token?: string;
  user?: { id: number; account: string };
}

/**
 * 直接打 backend login 拿 JWT（避免每個 spec 走完整登入頁面 form）。
 * 寫進 localStorage 模擬已登入狀態，並回 token 給 caller 後續 cleanup 用。
 */
export async function loginAsTestUser(page: Page): Promise<string> {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL / E2E_USER_PASSWORD 環境變數沒設。請建 .env.test 或 export 這兩個變數。",
    );
  }
  const resp = await axios.post<LoginResp>(`${API_BASE}/login`, {
    account: email,
    password,
  });
  const body = resp.data;
  const token = body.data?.token ?? body.token;
  const user = body.data?.user ?? body.user;
  if (!token || !user) {
    throw new Error(`backend login 回應 shape 異常: ${JSON.stringify(body).slice(0, 200)}`);
  }
  // 進站時 inject 到 localStorage
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("user", JSON.stringify(user));
    },
    { token, user },
  );
  return token;
}

// ───── Phase 2 Task 3 e2e ephemeral test user (backend commit 2a7716a) ─────

interface EphemeralUser {
  token: string;
  userId: number;
  account: string;
}

/**
 * 建 ephemeral test user — backend `POST /api/test/users/ephemeral`
 * (env-guarded by `APP_E2E_ENABLED=true`, prefix `e2e_ephemeral_*`)
 *
 * 對齊 wiki #382 helper sketch：addInitScript 注 token 進 localStorage，
 * page 訪問時直接帶 auth。每 test isolation + parallel-safe — 解 #306
 * finding A workers:1 ~10min 瓶頸。
 *
 * 用法 (對 specs):
 * ```ts
 * let ephemeralUserId: number;
 * test.beforeEach(async ({ page }) => {
 *   const u = await createEphemeralUser(page);
 *   ephemeralUserId = u.userId;
 * });
 * test.afterEach(async () => {
 *   await destroyEphemeralUser(ephemeralUserId);
 * });
 * ```
 */
export async function createEphemeralUser(page: Page): Promise<EphemeralUser> {
  const resp = await axios.post(`${API_BASE}/test/users/ephemeral`);
  const body = resp.data;
  const token = body?.data?.token;
  const user = body?.data?.user;
  if (!token || !user) {
    throw new Error(
      `ephemeral user create failed: ${JSON.stringify(body).slice(0, 200)}`,
    );
  }
  // page navigate 之前 inject 進 localStorage（既有 loginAsTestUser pattern）
  await page.addInitScript(
    ({ token, user }) => {
      window.localStorage.setItem("token", token);
      window.localStorage.setItem("user", JSON.stringify(user));
    },
    { token, user },
  );
  return { token, userId: user.id, account: user.account };
}

/**
 * Destroy ephemeral user — backend cascade delete drive_files / folders /
 * shares / share-links。
 * fence: account prefix `e2e_ephemeral_*` 防誤刪真 user。
 *
 * 失敗不 throw（test 已過 / cleanup-only 場景），改 console.warn 給 visibility。
 */
export async function destroyEphemeralUser(userId: number): Promise<void> {
  try {
    await axios.delete(`${API_BASE}/test/users/ephemeral/${userId}`);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn(
      `ephemeral user destroy failed: id=${userId}, ${err?.response?.status ?? err}`,
    );
  }
}

/**
 * 清空當前 user 的 drive 資料 — 列 root + 對每個 file/folder 呼叫 delete。
 *
 * Phase 1 後 prefer createEphemeralUser (per-test isolation 強)；本 helper
 * 留作 dev manual smoke fallback 或 legacy spec compat。
 *
 * Folder 必須空才能刪 → 由 leaf 往上 delete (folders 列表已 root only;
 * 多層需 recursion，MVP 假設 test 不留太深的 tree)。
 */
export async function cleanupUserDrive(token: string): Promise<void> {
  const headers = { Authorization: `Bearer ${token}` };

  // 簡單方案: 列 root → delete files → delete folders
  // 多層 folders 留給 backend 提供 reset endpoint 或 spec §13.1 的 test API
  const filesResp = await axios.get(`${API_BASE}/drive/files`, {
    headers,
    params: { sort: "name", page: 1, size: 200 },
  });
  const files = filesResp.data?.data?.items ?? [];
  for (const f of files) {
    await axios.delete(`${API_BASE}/drive/files/${f.id}`, { headers });
  }
  const foldersResp = await axios.get(`${API_BASE}/drive/folders`, { headers });
  const folders = foldersResp.data?.data?.items ?? [];
  for (const f of folders) {
    try {
      await axios.delete(`${API_BASE}/drive/folders/${f.id}`, { headers });
    } catch {
      // FOLDER_NOT_EMPTY — 留給 backend reset endpoint 或手動處理
    }
  }
}
