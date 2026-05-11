/**
 * KOATAG user shape — backend `/api/drive/users/search` response item
 * (per koatag commit `796d37a` final shape after `aa0c5f4` + `02e3a9f` + throttle fix)
 *
 * 主 identifier 是 `account`（KOATAG 登入 + UserCard 慣例）。`name` 可能 NULL
 * (DB 沒強制 NOT NULL，user 沒設定 display name 時)。`avatar_url` 預留 nullable
 * (avatar upload feature 還沒)。
 */
export interface User {
  id: number;
  account: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}
