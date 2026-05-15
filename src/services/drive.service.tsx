import driveApi, { DriveServiceError, unwrapDriveBody } from "api/driveAxios";
import type { ImageData } from "components/types/images";
import type { User } from "components/types/users";

export { DriveServiceError };

export interface DriveFile {
  id: number;
  owner_id: number;
  folder_id: number | null;
  name: string;
  mime: string;
  size_bytes: number;
  checksum_sha1: string;
  thumb_path: string | null;
  // v2-X drive_files.image_data_id alter (backend commit b6f0bb6)：
  // null 或數字；null → 未連結 / 數字 → 連結到 image_datas.id
  image_data_id: number | null;
  // 帶 ?include=image_data query 才出現；UI (b) readonly tag display 用
  image_data?: ImageData;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// v3 Trash UI — soft-deleted file augmented with retention metadata
// (backend #498，30-day retention 預備)
export interface TrashedFile extends DriveFile {
  // soft delete 時間 — DriveFile 既有，但 trash 列表必有
  deleted_at: string;
  // deleted_at + 30 day（backend 算）
  permanent_delete_at: string;
  // ceil((permanent_delete_at - now) / 86400) — backend compute；< 7 為近期警告 UI
  days_remaining: number;
}

export interface DriveFolder {
  id: number;
  owner_id: number;
  parent_id: number | null;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface DriveQuota {
  used_bytes: number;
  quota_bytes: number;
  ratio: number;
}

export interface PagedMeta {
  total: number;
  page: number;
  size: number;
  total_pages: number;
}

export interface PagedResp<T> {
  items: T[];
  meta: PagedMeta;
}

export type SortKey = "name" | "size_bytes" | "created_at" | "updated_at";
export type SortOrder = "asc" | "desc";

export const SORT_LABELS: Record<SortKey, string> = {
  name: "名稱",
  size_bytes: "檔案大小",
  created_at: "建立時間",
  updated_at: "修改時間",
};

export const MAX_SYNC_UPLOAD_BYTES = 50 * 1024 * 1024;

/**
 * 暫時 graceful 404 — backend B9 (folders) / B12 (quota) 尚未實作期間，
 * `/drive/folders` / `/drive/quota` 等 endpoint 會 404。
 * 視為「資料不存在 → 空回應」而非錯誤，避免 DrivePage 整頁顯示 error
 * 蓋掉 list 結果。B9/B12 完成後 endpoint 會 200，自動正確。
 *
 * 只對特定 endpoint 用（listFolders / getBreadcrumb / getQuota）。
 * listFiles 不做（核心功能 B8a 已 up）。
 */
function is404(err: unknown): boolean {
  return (err as any)?.response?.status === 404;
}

interface ListFilesOpts {
  folderId: number | null;
  sort?: SortKey;
  order?: SortOrder;
  q?: string;
  page?: number;
  size?: number;
}

export async function getFile(
  fileId: number,
  opts: { include?: "image_data" } = {}
): Promise<DriveFile> {
  const params: Record<string, string> = {};
  if (opts.include) params.include = opts.include;
  const resp: any = await driveApi.get(`/drive/files/${fileId}`, { params });
  const { data } = unwrapDriveBody<{ file: DriveFile }>(resp.data);
  return data.file;
}

export async function listFiles(opts: ListFilesOpts): Promise<PagedResp<DriveFile>> {
  const params = {
    folder_id: opts.folderId,
    sort: opts.sort ?? "name",
    order: opts.order ?? "asc",
    q: opts.q,
    page: opts.page ?? 1,
    size: opts.size ?? 30,
  };
  const resp: any = await driveApi.get("/drive/files", { params });
  const { data, meta } = unwrapDriveBody<{ items: DriveFile[] }>(resp.data);
  return { items: data.items, meta };
}

export async function listFolders(parentId: number | null): Promise<DriveFolder[]> {
  try {
    const resp: any = await driveApi.get("/drive/folders", {
      params: { parent_id: parentId },
    });
    const { data } = unwrapDriveBody<{ items: DriveFolder[] }>(resp.data);
    return data.items;
  } catch (err) {
    if (is404(err)) return []; // B9 未實作期間，graceful empty
    throw err;
  }
}

export async function getBreadcrumb(folderId: number): Promise<DriveFolder[]> {
  try {
    const resp: any = await driveApi.get(`/drive/folders/${folderId}/breadcrumb`);
    const { data } = unwrapDriveBody<{ breadcrumb: DriveFolder[] }>(resp.data);
    return data.breadcrumb;
  } catch (err) {
    if (is404(err)) return []; // B9 未實作期間，graceful empty
    throw err;
  }
}

interface FolderViewOpts {
  sort?: SortKey;
  order?: SortOrder;
  q?: string;
  page?: number;
  size?: number;
}

export async function loadFolderView(
  folderId: number | null,
  opts: FolderViewOpts = {}
): Promise<{
  folders: DriveFolder[];
  files: PagedResp<DriveFile>;
  breadcrumb: DriveFolder[];
}> {
  const [folders, files, breadcrumb] = await Promise.all([
    listFolders(folderId),
    listFiles({ folderId, ...opts }),
    folderId != null ? getBreadcrumb(folderId) : Promise.resolve([] as DriveFolder[]),
  ]);
  return { folders, files, breadcrumb };
}

export async function uploadFile(
  file: File,
  folderId: number | null,
  onProgress?: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<DriveFile> {
  if (file.size > MAX_SYNC_UPLOAD_BYTES) {
    throw new DriveServiceError("FILE_TOO_LARGE", "檔案超過 50MB 限制", {
      max_bytes: MAX_SYNC_UPLOAD_BYTES,
      actual_bytes: file.size,
    });
  }
  const fd = new FormData();
  fd.append("file", file);
  if (folderId != null) fd.append("folder_id", String(folderId));
  const config: any = {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
    onUploadProgress: (e: any) => {
      if (onProgress) onProgress(e.loaded, e.total ?? 0);
    },
  };
  const resp: any = await driveApi.post("/drive/files", fd, config);
  const { data } = unwrapDriveBody<{ file: DriveFile }>(resp.data);
  return data.file;
}

/**
 * Drive 檔案 streaming / 下載 / 縮圖 URL 採用 signed URL pattern（backend spec §16，B17 + B8a）：
 * 1. frontend POST /drive/files/{id}/stream-url 帶 JWT → backend 驗 ACL + 簽 HMAC sig
 * 2. backend 回 `{ok:true, data:{file_id, sig, exp}}`（v1.8 shape，spec §16.2）
 * 3. frontend self-compose URL：
 *    - stream/inline: `${API_URL}/drive/files/{id}/download?sig=...&exp=...`
 *    - download attachment: 同上 + `&download=1`
 *    - thumb: `${API_URL}/drive/files/{id}/thumb?sig=...&exp=...`
 * 4. browser native fetch 走 GET endpoint，**不過 JwtMiddleware**，純 HMAC verify
 *
 * HMAC payload `"${id}:${exp}"` 不含 path → sig 對 /download 與 /thumb 同 valid。
 * → 同一 fileId 簽 1 次，所有 kind (download / thumb) 都通 → cache key 只用 fileId。
 *
 * URL 用 `REACT_APP_API_URL` 為 base，產出 absolute URL 直接給 `<video>` / `<img>` / `<a>` 吃，
 * 跨 origin（dev: localhost:3000 ↔ koatag.com:8123）也能正確 resolve。
 *
 * 配對 hook：`useDriveStreamUrl(fileId, mode)` 包 useEffect/useState（見 src/hooks/useDriveStreamUrl）。
 *
 * Module-level cache（v2 unification, addresses wiki finding T6 A / T12 B+C / T13 B+H）：
 * - sigCache: Map<fileId, {sig, exp}> 共用 sig；exp - now < buffer 視為 stale 不 reuse
 * - inFlight: Map<fileId, Promise> 同 fileId 並發 request de-dupe，30 卡片頁從
 *   30 POST 降到 1 POST + 29 share
 * - delete file 時 invalidateSigCache(fileId) 主動清；其他情境靠 lazy expiry
 * - 沒 size cap 設計（單 user single session 不太可能 unique fileId 爆量），
 *   v3 evaluate 加 LRU 若需要
 */
interface SignedUrlPayload {
  file_id: number;
  sig: string;
  exp: number;
}

interface CachedSig {
  sig: string;
  exp: number;
}

const SIG_REFRESH_BUFFER_SECONDS = 30;
const sigCache = new Map<number, CachedSig>();
const sigInFlight = new Map<number, Promise<SignedUrlPayload>>();

function readCachedSig(fileId: number): SignedUrlPayload | null {
  const cached = sigCache.get(fileId);
  if (!cached) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  if (cached.exp - nowSec < SIG_REFRESH_BUFFER_SECONDS) {
    sigCache.delete(fileId);
    return null;
  }
  return { file_id: fileId, sig: cached.sig, exp: cached.exp };
}

/**
 * 主動清 cache —— 跟 backend revoke / delete 同步用。
 * 純 cache 操作不打 backend；caller 負責決定何時 invalidate。
 */
export function invalidateSigCache(fileId?: number): void {
  if (fileId == null) {
    sigCache.clear();
    sigInFlight.clear();
  } else {
    sigCache.delete(fileId);
    sigInFlight.delete(fileId);
  }
}

async function fetchSignedPayload(fileId: number): Promise<SignedUrlPayload> {
  // 1) cache hit (within exp - 30s buffer)
  const cached = readCachedSig(fileId);
  if (cached) return cached;

  // 2) in-flight de-dupe
  const existing = sigInFlight.get(fileId);
  if (existing) return existing;

  // 3) new fetch
  const promise = (async () => {
    try {
      const resp: any = await driveApi.post(`/drive/files/${fileId}/stream-url`);
      const { data } = unwrapDriveBody<SignedUrlPayload>(resp.data);
      sigCache.set(fileId, { sig: data.sig, exp: data.exp });
      return data;
    } finally {
      sigInFlight.delete(fileId);
    }
  })();
  sigInFlight.set(fileId, promise);
  return promise;
}

function composeFileUrl(payload: SignedUrlPayload, kind: "download" | "thumb"): string {
  const base = process.env.REACT_APP_API_URL || "/api";
  return `${base}/drive/files/${payload.file_id}/${kind}?sig=${payload.sig}&exp=${payload.exp}`;
}

export async function streamUrl(fileId: number): Promise<string> {
  const payload = await fetchSignedPayload(fileId);
  return composeFileUrl(payload, "download");
}

export async function downloadUrl(fileId: number): Promise<string> {
  const payload = await fetchSignedPayload(fileId);
  return `${composeFileUrl(payload, "download")}&download=1`;
}

export async function thumbUrl(fileId: number): Promise<string> {
  const payload = await fetchSignedPayload(fileId);
  return composeFileUrl(payload, "thumb");
}

export async function deleteFile(fileId: number): Promise<void> {
  await driveApi.delete(`/drive/files/${fileId}`);
  invalidateSigCache(fileId);
}

// ───── v3 Trash UI (backend #498) ─────

interface ListTrashOpts {
  sort?: SortKey;
  order?: SortOrder;
  page?: number;
  size?: number;
}

export async function listTrash(
  opts: ListTrashOpts = {}
): Promise<PagedResp<TrashedFile>> {
  const params = {
    sort: opts.sort,
    order: opts.order,
    page: opts.page ?? 1,
    size: opts.size ?? 30,
  };
  try {
    const resp: any = await driveApi.get("/drive/files/trash", { params });
    const { data, meta } = unwrapDriveBody<{ items: TrashedFile[] }>(resp.data);
    return { items: data.items, meta };
  } catch (err) {
    if (is404(err)) {
      // backend #498 未實作期間：graceful empty (對齊 listFolders / getQuota pattern)
      return {
        items: [],
        meta: { total: 0, page: 1, size: opts.size ?? 30, total_pages: 0 },
      };
    }
    throw err;
  }
}

export async function restoreFile(fileId: number): Promise<DriveFile> {
  const resp: any = await driveApi.post(`/drive/files/${fileId}/restore`);
  const { data } = unwrapDriveBody<{ file: DriveFile }>(resp.data);
  invalidateSigCache(fileId);
  return data.file;
}

export async function permanentDeleteFile(
  fileId: number
): Promise<{ released_bytes: number }> {
  // wiki dispatch 兩 URL 形式都列；用 query flag 形式對齊 RESTful DELETE 慣例
  const resp: any = await driveApi.delete(`/drive/files/${fileId}`, {
    params: { permanent: 1 },
  });
  const { data } = unwrapDriveBody<{ released_bytes: number }>(resp.data);
  invalidateSigCache(fileId);
  return data;
}

export async function createFolder(
  name: string,
  parentId: number | null
): Promise<DriveFolder> {
  const resp: any = await driveApi.post("/drive/folders", {
    name,
    parent_id: parentId,
  });
  const { data } = unwrapDriveBody<{ folder: DriveFolder }>(resp.data);
  return data.folder;
}

export async function deleteFolder(folderId: number): Promise<void> {
  await driveApi.delete(`/drive/folders/${folderId}`);
}

interface RenameOrMoveOpts {
  resourceType: "file" | "folder";
  resourceId: number;
  newName?: string;
  targetFolderId?: number | null;
}

export async function renameOrMove(opts: RenameOrMoveOpts): Promise<void> {
  const base = opts.resourceType === "file" ? "/drive/files" : "/drive/folders";
  const body: Record<string, unknown> = {};
  if (opts.newName !== undefined) body.name = opts.newName;
  if (opts.targetFolderId !== undefined) {
    body[opts.resourceType === "file" ? "folder_id" : "parent_id"] = opts.targetFolderId;
  }
  await driveApi.patch(`${base}/${opts.resourceId}`, body);
}

export async function getQuota(): Promise<DriveQuota | null> {
  try {
    const resp: any = await driveApi.get("/drive/quota");
    const { data } = unwrapDriveBody<{ quota: DriveQuota }>(resp.data);
    return data.quota;
  } catch (err) {
    if (is404(err)) return null; // B12 未實作期間，quota 視為未知
    throw err;
  }
}

interface CreateShareOpts {
  resourceType: "file" | "folder";
  resourceId: number;
  granteeId: number;
  permission: "read" | "write";
  expiresAt?: string;
}

export async function createShare(opts: CreateShareOpts): Promise<{ id: number }> {
  const resp: any = await driveApi.post("/drive/shares", {
    resource_type: opts.resourceType,
    resource_id: opts.resourceId,
    grantee_id: opts.granteeId,
    permission: opts.permission,
    expires_at: opts.expiresAt,
  });
  const { data } = unwrapDriveBody<{ share: { id: number } }>(resp.data);
  return data.share;
}

/**
 * Revoke 結果含 cascade move trace（Task 2 backend `6fb4fc0`）：
 * - moved_files > 0：grantee 在 shared folder 內創檔已 move 到 grantee root
 *   （A1 borrowee owns semantic — wiki #390 design freeze）
 * - file share revoke 永遠 moved_files = 0（file 不會 cascade）
 */
export async function revokeShare(
  shareId: number,
): Promise<{ share_id: number; moved_files: number }> {
  const resp: any = await driveApi.delete(`/drive/shares/${shareId}`);
  // backend response: { ok, data: { share_id, moved_files } }
  // 容讓舊 backend 不回 body 的情境（pre `6fb4fc0`），fallback to 0
  const data = resp.data?.data;
  return {
    share_id: data?.share_id ?? shareId,
    moved_files: data?.moved_files ?? 0,
  };
}

/**
 * Update share permission (Task 2 backend `6fb4fc0`, PATCH partial)
 * 只 grantor 可改；audit `drive.share.permission_update`
 */
export async function updateSharePermission(
  shareId: number,
  permission: "read" | "write",
): Promise<void> {
  await driveApi.patch(`/drive/shares/${shareId}`, { permission });
}

interface CreateShareLinkOpts {
  resourceType: "file" | "folder";
  resourceId: number;
  permission: "read" | "write";
  expiresAt?: string;
  maxUses?: number;
}

export async function createShareLink(
  opts: CreateShareLinkOpts
): Promise<{ id: number; token: string }> {
  const resp: any = await driveApi.post("/drive/share-links", {
    resource_type: opts.resourceType,
    resource_id: opts.resourceId,
    permission: opts.permission,
    expires_at: opts.expiresAt,
    max_uses: opts.maxUses,
  });
  // backend B11 回 `data.share_link`（含 id/token + 其他 metadata）
  const { data } = unwrapDriveBody<{ share_link: { id: number; token: string } }>(
    resp.data,
  );
  return data.share_link;
}

export async function revokeShareLink(linkId: number): Promise<void> {
  await driveApi.delete(`/drive/share-links/${linkId}`);
}

// ───── Phase 1 user search (autocomplete) ─────

/**
 * 搜尋 KOATAG users — ShareDialog autocomplete 用。
 * backend `GET /api/drive/users/search?q=&limit=10` (commits aa0c5f4 + 02e3a9f + 796d37a)：
 * - q.length >= 2 (backend < 2 直接回 [] 無 audit；frontend 也 client-guard 省 round trip)
 * - throttle 60/min (debounce 300ms 對齊)
 * - exclude current user (backend 過濾)
 * - LIKE escape (% / _ literal)
 */
export async function searchUsers(q: string, limit = 10): Promise<User[]> {
  const resp: any = await driveApi.get("/drive/users/search", {
    params: { q, limit },
  });
  const { data } = unwrapDriveBody<{ items: User[] }>(resp.data);
  return data.items;
}

// ───── v3 list / landing helpers ─────

export interface ShareResourceSummary {
  id: number;
  name: string;
  mime?: string;
  size_bytes?: number;
}

export interface IncomingShare {
  id: number;
  resource_type: "file" | "folder";
  resource: ShareResourceSummary;
  granter_id: number;
  granter?: { id: number; account: string };
  permission: "read" | "write";
  expires_at: string | null;
  created_at: string;
}

export interface OutgoingShare {
  id: number;
  resource_type: "file" | "folder";
  resource: ShareResourceSummary;
  grantee_id: number;
  grantee?: { id: number; account: string };
  permission: "read" | "write";
  expires_at: string | null;
  created_at: string;
}

export interface MyShareLink {
  id: number;
  token: string;
  resource_type: "file" | "folder";
  resource: ShareResourceSummary;
  permission: "read" | "write";
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
  revoked_at: string | null;
  created_at: string;
}

export interface ShareLandingMeta {
  resource_type: "file" | "folder";
  resource: ShareResourceSummary;
  expires_at: string | null;
  max_uses: number | null;
  use_count: number;
}

export async function listIncomingShares(): Promise<IncomingShare[]> {
  const resp: any = await driveApi.get("/drive/shares/incoming");
  const { data } = unwrapDriveBody<{ items: IncomingShare[] }>(resp.data);
  return data.items;
}

export async function listOutgoingShares(): Promise<OutgoingShare[]> {
  const resp: any = await driveApi.get("/drive/shares/outgoing");
  const { data } = unwrapDriveBody<{ items: OutgoingShare[] }>(resp.data);
  return data.items;
}

export async function listMyShareLinks(): Promise<MyShareLink[]> {
  const resp: any = await driveApi.get("/drive/share-links/outgoing");
  const { data } = unwrapDriveBody<{ items: MyShareLink[] }>(resp.data);
  return data.items;
}

/**
 * 公開 share-link landing meta — 不帶 JWT，純 token 驗證（spec §3.5）。
 * 用 plain fetch 避開 driveApi 的 Authorization header interceptor。
 * landing 不消耗 use_count；download 才 atomic consume（backend `b11` 確認）。
 */
export async function getShareLanding(token: string): Promise<ShareLandingMeta> {
  const base = process.env.REACT_APP_API_URL || "/api";
  const resp = await fetch(`${base}/p/${encodeURIComponent(token)}`, {
    headers: { Accept: "application/json" },
  });
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok || body?.ok === false) {
    const err = body?.error ?? {};
    throw new DriveServiceError(
      err.code ?? "SHARE_LINK_INVALID",
      err.message ?? "分享連結無效",
      err.details,
    );
  }
  return body.data;
}

// `<a href>` 直接點：絕對 URL 跨 origin 也 work（同 composeFileUrl pattern）
export function publicAccessUrl(token: string): string {
  const base = process.env.REACT_APP_API_URL || "/api";
  return `${base}/p/${encodeURIComponent(token)}`;
}

export function publicDownloadUrl(token: string): string {
  const base = process.env.REACT_APP_API_URL || "/api";
  return `${base}/p/${encodeURIComponent(token)}/download`;
}
