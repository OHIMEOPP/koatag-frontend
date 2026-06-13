import { DriveServiceError } from "api/driveAxios";

const driveErrorMessages: Record<string, string> = {
  UNAUTHORIZED: "請先登入",
  FORBIDDEN: "沒有權限存取此資源",
  IDOR_DENIED: "安全性檢查未通過",
  NOT_FOUND: "資源不存在",
  FILE_NOT_FOUND: "檔案不存在或已刪除",
  FOLDER_NOT_FOUND: "資料夾不存在",
  FILE_TOO_LARGE: "檔案超過 2GB 限制",
  INVALID_MIME: "不支援的檔案類型",
  // R3 #7 §2.2.2 — client-side magic-byte gate (E2EE era). UNSUPPORTED_MIME is
  // a strict block (whitelist violation); POLYGLOT_WARN is a non-blocking
  // advisory (claimed ≠ detected — still uploads, per §3 #3 LOCKED).
  UNSUPPORTED_MIME: "不支援的檔案類型，已略過",
  POLYGLOT_WARN: "⚠ 副檔名與內容類型不符，仍會上傳",
  // Security follow-up — 類型檢查本身失敗（檔案無法讀取等）時 fail-closed 擋下，
  // 不靜默放行未驗證的上傳（加密路徑後端無法驗內容，client gate 是唯一防線）。
  MIME_CHECK_FAILED: "檔案類型檢查失敗，已擋下；請重試或更換檔案",
  // R2 #4 cutover（fe-cutover §2.2.3 / enforce-safety §2.2）— E2EE enforce era.
  // KEYS_MISSING：encrypt 路徑在 refresh-window（JWT 在、in-memory 金鑰 reset null）
  //   丟出；force-re-login gate（RequireKeys）為主防線，此文案是繞過 gate 時的後備。
  KEYS_MISSING: "尚未登入或金鑰已失效，請重新登入",
  // PLAINTEXT_UPLOAD_DISABLED：部署縫隙後備（舊 bundle session 在 flag 翻 true 後仍
  //   送明文 → server 回 422）。server message 未必中文/未必引導 reload，FE 端定文案。
  PLAINTEXT_UPLOAD_DISABLED: "系統已更新為強制加密上傳，請重新整理頁面後再試",
  // R2 #4 cutover — encrypted-download 4-layer fail differentiation (drive.download.ts).
  WRAP_DECRYPT: "金鑰解封失敗，請重新登入後再試",
  MANIFEST_FAIL: "無法取得檔案下載資訊，請稍後再試",
  FETCH_FAIL: "下載中斷，請檢查網路後重試",
  CHUNK_HASH: "檔案完整性檢查失敗，資料可能已損毀",
  CHUNK_DECRYPT: "檔案解密失敗，金鑰異常或資料已被竄改",
  DOWNLOAD_ABORTED: "下載已取消",
  QUOTA_EXCEEDED: "您的 Drive 容量已滿，請刪除部分檔案",
  UPLOAD_NO_FILE: "請選擇要上傳的檔案",
  UPLOAD_FAILED: "上傳失敗，請稍後再試",
  FOLDER_NOT_EMPTY: "資料夾不為空，請先清空",
  MOVE_INTO_DESCENDANT: "不能將資料夾移到自己的子目錄",
  INVALID_PARENT: "父資料夾不存在或無權限",
  NAME_REQUIRED: "請輸入名稱",
  NAME_TOO_LONG: "名稱長度超過 255 字元",
  SHARE_SELF: "不能分享給自己",
  SHARE_DUPLICATE: "此資源已分享給該使用者",
  SHARE_LINK_EXPIRED: "此分享連結已過期",
  SHARE_LINK_REVOKED: "此分享連結已被撤銷",
  SHARE_LINK_USED_UP: "此分享連結已達使用次數上限",
  SHARE_LINK_INVALID: "分享連結不存在",
  INVALID_IMAGE_DATA: "指定的圖片資料不存在或無權連結",
  // v3 Trash UI (backend #498)
  OUTSIDE_RETENTION: "此檔案已超過 30 天保留期，無法還原",
  NOT_TRASHED: "此檔案不在垃圾桶內",
  INTERNAL_ERROR: "系統錯誤，請稍後再試",
};

// R3 #7 §2.2.2 — map a bare drive error code to its display string. Used by the
// upload queue when it sets a client-side reject/warn (UNSUPPORTED_MIME /
// POLYGLOT_WARN) without a thrown DriveServiceError.
export function messageForCode(code: string): string {
  return driveErrorMessages[code] ?? code;
}

export function mapDriveError(err: unknown): string {
  if (err instanceof DriveServiceError) {
    return driveErrorMessages[err.code] ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return "發生未知錯誤";
}

export interface DriveErrorInfo {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export function getDriveErrorDetails(err: unknown): DriveErrorInfo | null {
  if (err instanceof DriveServiceError) {
    return {
      code: err.code,
      message: driveErrorMessages[err.code] ?? err.message,
      details: err.details as Record<string, unknown> | undefined,
    };
  }
  return null;
}
