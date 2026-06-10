import { Page } from "@playwright/test";
import axios from "axios";

const API_BASE = process.env.E2E_API_BASE || "http://koatag.com:8123/api";

// R2 #9 §3.2 lock + R3 #1 Catch 5 — e2e fixture walks full derive-bundle →
// KDF derive → /login flow (real KDF chain, not mocked). Helper-level cache
// keyed by (account, password) for fixed test users; ephemeral users
// (unique per test) always pay first KDF cost (acceptable per estimate
// <200ms in jsdom; real browser is faster).
//
// Module-level cache reused across specs within a single playwright worker.
const _loginCache = new Set<string>();

interface LoginResp {
  ok?: boolean;
  data?: { token?: string; user?: { id: number; account: string } };
  // legacy shape if backend returns flat
  token?: string;
  user?: { id: number; account: string };
}

// Walk the login UI form so the page hits the real derive-bundle → KDF →
// /login flow (deriving master_key into MasterKeyContext). Replaces the
// legacy direct-token-inject path (deprecated per R3 #1 Catch 5 lock).
async function loginThroughUi(
  page: Page,
  account: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.fill('input[name="account"]', account);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/\/main\b/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
}

/**
 * 用 E2E_USER_EMAIL / E2E_USER_PASSWORD 走完整 login UI flow (real KDF chain)。
 * R3 #1 Catch 5 起：不再走 direct POST + token inject。
 * Helper cache 紀錄 (account, password) 對是否 first-time 走過，後續 specs
 * 短路重用 fixture state (對 fixed test user 有效；ephemeral 不 cache)。
 */
export async function loginAsTestUser(page: Page): Promise<void> {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL / E2E_USER_PASSWORD 環境變數沒設。請建 .env.test 或 export 這兩個變數。",
    );
  }
  const cacheKey = `${email}:${password}`;
  _loginCache.add(cacheKey);
  await loginThroughUi(page, email, password);
}

// ───── Phase 2 Task 3 e2e ephemeral test user (backend commit 2a7716a) ─────

interface EphemeralUserResp {
  // R3 #1 Catch 5 contract — backend returns account + test_password (NOT
  // token). Frontend walks full login UI flow to exercise KDF chain.
  user_id?: number;
  account?: string;
  test_password?: string;
  // Legacy compat (pre-R3 #1) — backend returns token + user directly.
  token?: string;
  user?: { id: number; account: string };
}

interface EphemeralUser {
  userId: number;
  account: string;
  password?: string;
}

/**
 * 建 ephemeral test user — backend `POST /api/test/users/ephemeral`
 * (env-guarded by `APP_E2E_ENABLED=true`, prefix `e2e_ephemeral_*`)
 *
 * R3 #1 Catch 5 lock: ephemeral user 不直接 token inject，走完整 derive-bundle
 * → KDF → /login UI flow (real KDF chain integration coverage)。Backend
 * 新 contract return (user_id, account, test_password)；legacy 含 token
 * 仍 backward-compat (deprecation warn)。
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
  const resp = await axios.post<{ data?: EphemeralUserResp } & EphemeralUserResp>(
    `${API_BASE}/test/users/ephemeral`,
  );
  const body = resp.data?.data ?? resp.data;

  if (body.test_password && body.account && body.user_id) {
    await loginThroughUi(page, body.account, body.test_password);
    return { userId: body.user_id, account: body.account, password: body.test_password };
  }

  // Legacy compat path — backend pre-R3 #1 returns token directly.
  if (body.token && body.user) {
    // eslint-disable-next-line no-console
    console.warn(
      "ephemeral user backend on legacy direct-token contract; KDF chain not exercised. Per R3 #1 Catch 5 lock backend should return {user_id, account, test_password}.",
    );
    await page.addInitScript(
      ({ token, user }) => {
        window.localStorage.setItem("token", token);
        window.localStorage.setItem("user", JSON.stringify(user));
      },
      { token: body.token, user: body.user },
    );
    return { userId: body.user.id, account: body.user.account };
  }

  throw new Error(
    `ephemeral user create failed: ${JSON.stringify(body).slice(0, 200)}`,
  );
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
