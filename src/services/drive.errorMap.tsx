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
