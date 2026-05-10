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
 * 寫進 localStorage 模擬已登入狀態。
 */
export async function loginAsTestUser(page: Page): Promise<void> {
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
}

/**
 * 清空當前 user 的 drive 資料 — 列 root + 對每個 file/folder 呼叫 delete。
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
