/**
 * Drive API axios instance.
 *
 * **Deviates from CLOUD_DRIVE_FRONTEND_SPEC.md §3.7**: spec 寫 axios success interceptor
 * 統一解包 `{ok, data}`，但因為既有 `axios@1.10.0` + `@types/axios@0.9.36`
 * type def 衝突（@types/axios 是給舊版 axios 的 ambient typing），
 * success interceptor 內 return Promise.reject 拖垮全局 type。
 *
 * 解法：success interceptor passive return；解包邏輯切到 `unwrapDriveBody<T>()` helper，
 * service 層每個 GET/POST 後自己呼叫。完成 T0 (移除 @types/axios) 後可考慮回到 spec §3.7。
 *
 * **Contract for void operations** (DELETE / PATCH 不取 body)：
 * 依賴 backend spec §9 — 任何錯誤一律回 4xx/5xx，由 error interceptor 接住 throw `DriveServiceError`。
 * 若 backend 違反此契約回 `200 + {ok:false}`，void op 會 silently 假成功（已知 risk，wiki review #3 acknowledged）。
 */
import axios from "axios";
import { logout } from "services/auth.service";
import { $message } from "utils";

export class DriveServiceError extends Error {
  public code: string;
  public details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "DriveServiceError";
    this.code = code;
    this.details = details;
  }
}

const driveApi = axios.create({
  baseURL: process.env.REACT_APP_API_URL || process.env.API_URL,
});

driveApi.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: any) => Promise.reject(error)
);

driveApi.interceptors.response.use(
  (response: any) => response,
  async (error: any) => {
    if (error?.response?.status === 401) {
      $message("登入超時，請重新登入");
      await logout();
      return Promise.reject(
        new DriveServiceError("UNAUTHORIZED", "登入超時，請重新登入")
      );
    }
    const respErr = error?.response?.data?.error;
    if (respErr) {
      return Promise.reject(
        new DriveServiceError(
          respErr.code ?? "UNKNOWN",
          respErr.message ?? "Unknown error",
          respErr.details
        )
      );
    }
    return Promise.reject(error);
  }
);

export function unwrapDriveBody<T = any>(respData: any): { data: T; meta?: any } {
  if (respData && typeof respData === "object" && "ok" in respData && respData.ok === false) {
    const err = respData.error ?? {};
    throw new DriveServiceError(
      err.code ?? "UNKNOWN",
      err.message ?? "Unknown error",
      err.details
    );
  }
  // Guard: ok:true 但缺 data field 的 degenerate case（void endpoint 不該走 unwrap）
  if (
    respData &&
    typeof respData === "object" &&
    respData.ok === true &&
    respData.data === undefined
  ) {
    throw new DriveServiceError(
      "MALFORMED_RESPONSE",
      "Backend returned ok:true without data field"
    );
  }
  return { data: respData?.data, meta: respData?.meta };
}

export default driveApi;
