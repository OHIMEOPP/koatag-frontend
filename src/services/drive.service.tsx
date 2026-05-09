import driveApi, { DriveServiceError, unwrapDriveBody } from "api/driveAxios";

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
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
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
 *    - stream/inline: `/api/drive/files/{id}/download?sig=...&exp=...`
 *    - download attachment: 同上 + `&download=1`
 *    - thumb: `/api/drive/files/{id}/thumb?sig=...&exp=...`
 * 4. browser native fetch 走 GET endpoint，**不過 JwtMiddleware**，純 HMAC verify
 *
 * HMAC payload `"${id}:${exp}"` 不含 path → sig 對 /download 與 /thumb 同 valid。
 * URL 用 absolute path（含 `/api/` 前綴）給 `<video>` / `<img>` / `<a>` 直接吃。
 *
 * 配對 hook：`useDriveStreamUrl(fileId, mode)` 包 useEffect/useState（見 src/hooks/useDriveStreamUrl）。
 */
interface SignedUrlPayload {
  file_id: number;
  sig: string;
  exp: number;
}

async function fetchSignedPayload(fileId: number): Promise<SignedUrlPayload> {
  const resp: any = await driveApi.post(`/drive/files/${fileId}/stream-url`);
  const { data } = unwrapDriveBody<SignedUrlPayload>(resp.data);
  return data;
}

function composeFileUrl(payload: SignedUrlPayload, kind: "download" | "thumb"): string {
  return `/api/drive/files/${payload.file_id}/${kind}?sig=${payload.sig}&exp=${payload.exp}`;
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

export async function revokeShare(shareId: number): Promise<void> {
  await driveApi.delete(`/drive/shares/${shareId}`);
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
  const { data } = unwrapDriveBody<{ link: { id: number; token: string } }>(resp.data);
  return data.link;
}

export async function revokeShareLink(linkId: number): Promise<void> {
  await driveApi.delete(`/drive/share-links/${linkId}`);
}

export function publicAccessUrl(token: string): string {
  return `/p/${token}`;
}

export function publicDownloadUrl(token: string): string {
  return `/p/${token}/download`;
}
