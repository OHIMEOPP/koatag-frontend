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
  const resp: any = await driveApi.get("/api/drive/files", { params });
  const { data, meta } = unwrapDriveBody<{ items: DriveFile[] }>(resp.data);
  return { items: data.items, meta };
}

export async function listFolders(parentId: number | null): Promise<DriveFolder[]> {
  const resp: any = await driveApi.get("/api/drive/folders", {
    params: { parent_id: parentId },
  });
  const { data } = unwrapDriveBody<{ items: DriveFolder[] }>(resp.data);
  return data.items;
}

export async function getBreadcrumb(folderId: number): Promise<DriveFolder[]> {
  const resp: any = await driveApi.get(`/api/drive/folders/${folderId}/breadcrumb`);
  const { data } = unwrapDriveBody<{ breadcrumb: DriveFolder[] }>(resp.data);
  return data.breadcrumb;
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
  const resp: any = await driveApi.post("/api/drive/files", fd, config);
  const { data } = unwrapDriveBody<{ file: DriveFile }>(resp.data);
  return data.file;
}

/**
 * Drive 檔案 streaming / 下載 / 縮圖 URL 採用 signed URL pattern（backend spec §16）：
 * 1. frontend POST /api/drive/files/{id}/stream-url 帶 JWT → backend 驗 ACL + 簽 HMAC sig
 * 2. backend 回 `{ url: "/api/drive/files/{id}/download?sig=xxx&exp=yyy" }`
 * 3. frontend 把 url 給 <video src> / <a href> / <img src>
 * 4. browser native fetch 走 GET endpoint，**不過 JwtMiddleware**，純 HMAC verify
 *
 * thumb 共用 sig（HMAC payload 是 "${id}:${exp}" 不含 path），swap `/download?` → `/thumb?` 即可。
 * download 用途（attachment）在簽完 URL 後 append `&download=1`。
 *
 * 配對 hook：`useDriveStreamUrl(fileId, mode)` 包 useEffect/useState（見 src/hooks/useDriveStreamUrl）。
 */
async function fetchSignedDownloadUrl(fileId: number): Promise<string> {
  const resp: any = await driveApi.post(`/api/drive/files/${fileId}/stream-url`);
  const { data } = unwrapDriveBody<{ url: string }>(resp.data);
  return data.url;
}

export async function streamUrl(fileId: number): Promise<string> {
  return fetchSignedDownloadUrl(fileId);
}

export async function downloadUrl(fileId: number): Promise<string> {
  const url = await fetchSignedDownloadUrl(fileId);
  // backend 簽出的 URL 必含 ?sig=&exp=；append &download=1 觸發 Content-Disposition: attachment
  return `${url}&download=1`;
}

export async function thumbUrl(fileId: number): Promise<string> {
  const url = await fetchSignedDownloadUrl(fileId);
  // HMAC payload 不含 path，sig 對 /download 與 /thumb 同 valid
  return url.replace("/download?", "/thumb?");
}

export async function deleteFile(fileId: number): Promise<void> {
  await driveApi.delete(`/api/drive/files/${fileId}`);
}

export async function createFolder(
  name: string,
  parentId: number | null
): Promise<DriveFolder> {
  const resp: any = await driveApi.post("/api/drive/folders", {
    name,
    parent_id: parentId,
  });
  const { data } = unwrapDriveBody<{ folder: DriveFolder }>(resp.data);
  return data.folder;
}

export async function deleteFolder(folderId: number): Promise<void> {
  await driveApi.delete(`/api/drive/folders/${folderId}`);
}

interface RenameOrMoveOpts {
  resourceType: "file" | "folder";
  resourceId: number;
  newName?: string;
  targetFolderId?: number | null;
}

export async function renameOrMove(opts: RenameOrMoveOpts): Promise<void> {
  const base = opts.resourceType === "file" ? "/api/drive/files" : "/api/drive/folders";
  const body: Record<string, unknown> = {};
  if (opts.newName !== undefined) body.name = opts.newName;
  if (opts.targetFolderId !== undefined) {
    body[opts.resourceType === "file" ? "folder_id" : "parent_id"] = opts.targetFolderId;
  }
  await driveApi.patch(`${base}/${opts.resourceId}`, body);
}

export async function getQuota(): Promise<DriveQuota> {
  const resp: any = await driveApi.get("/api/drive/quota");
  const { data } = unwrapDriveBody<{ quota: DriveQuota }>(resp.data);
  return data.quota;
}

interface CreateShareOpts {
  resourceType: "file" | "folder";
  resourceId: number;
  granteeId: number;
  permission: "read" | "write";
  expiresAt?: string;
}

export async function createShare(opts: CreateShareOpts): Promise<{ id: number }> {
  const resp: any = await driveApi.post("/api/drive/shares", {
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
  await driveApi.delete(`/api/drive/shares/${shareId}`);
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
  const resp: any = await driveApi.post("/api/drive/share-links", {
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
  await driveApi.delete(`/api/drive/share-links/${linkId}`);
}

export function publicAccessUrl(token: string): string {
  return `/api/p/${token}`;
}

export function publicDownloadUrl(token: string): string {
  return `/api/p/${token}/download`;
}
