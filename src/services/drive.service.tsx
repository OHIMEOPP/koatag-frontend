import driveApi, { DriveServiceError, unwrapDriveBody } from "api/driveAxios";
import type { ImageData } from "components/types/images";
import type { User } from "components/types/users";
import { getKeyBundleRef } from "../contexts/MasterKeyContext";
import {
  decryptName,
  unwrapKey,
  encryptName,
  encryptBlob,
  encryptChunk,
  wrapFileKey,
  generateFileKey,
  chunkAad,
  freshChunkIv,
  sha256,
} from "./crypto/aead";

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
  // R3 #2 §1.1 (R2 #2 §2.1.1) — E2EE columns. For encrypted rows: backend
  // returns name=null and mime='application/octet-stream'; the service
  // layer populates plaintext `name` in-memory after decrypt. UI consumers
  // read `name` / `mime` as before — encryption is transparent.
  name_encrypted?: string | null;
  name_iv?: string | null;
  key_wrap?: string | null;
  mime_claimed?: string | null;
  is_encrypted?: boolean;
}

// v3 Trash UI — soft-deleted file augmented with retention metadata
// (backend #498，30-day retention 預備)
// R3 #6 §1.1 — adds resource_type discriminator for unified folder+file list.
// E2EE columns inherited from DriveFile (name_encrypted etc.) — listTrash
// applies _decryptDriveFile to populate plaintext name in-memory.
export interface TrashedFile extends DriveFile {
  resource_type: "file";
  // soft delete 時間 — DriveFile 既有，但 trash 列表必有
  deleted_at: string;
  // deleted_at + 30 day（backend 算）
  permanent_delete_at: string;
  // ceil((permanent_delete_at - now) / 86400) — backend compute；< 7 為近期警告 UI
  days_remaining: number;
}

// R3 #6 §1.1 — trashed folder (cascade soft-delete). Backend §3.2 returns
// folders alongside files in /drive/trash unified list; frontend renders
// both with resource_type discriminator + lock badge on encrypted rows
// (per R3 #6 §1.4 — UI defer R3 housekeeping).
export interface TrashedFolder extends DriveFolder {
  resource_type: "folder";
  deleted_at: string;
  permanent_delete_at: string;
  days_remaining: number;
}

export type TrashedItem = TrashedFile | TrashedFolder;

export interface DriveFolder {
  id: number;
  owner_id: number;
  parent_id: number | null;
  name: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // R3 #2 §1.1 (R2 #2 §2.1.2) — E2EE columns (no mime_claimed for folders).
  name_encrypted?: string | null;
  name_iv?: string | null;
  key_wrap?: string | null;
  is_encrypted?: boolean;
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

// D.12 (2026-05-15): per user request 單檔上限 50MB → 2GB（配合 quota 20GB）
export const MAX_SYNC_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

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

// ───── R3 #2 §1.2-§1.3: E2EE decrypt helpers ─────

// Placeholder when name decryption fails or keys are missing. Distinct strings
// for distinct failure modes so UI can tell them apart without needing extra
// state fields (per §1.5 dispatch — single name field, distinguishable copy).
const DECRYPT_PLACEHOLDER = "[無法解開]";
const KEYS_MISSING_PLACEHOLDER = "[未登入]";
const SCHEMA_INCOMPLETE_PLACEHOLDER = "[資料不完整]";

function _base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Exported with `_` prefix to signal internal-but-testable. Re-exporting from
// the service module lets unit tests cover the per-row decrypt logic without
// going through axios mocks.
export const _placeholders = {
  decrypt: DECRYPT_PLACEHOLDER,
  keysMissing: KEYS_MISSING_PLACEHOLDER,
  schemaIncomplete: SCHEMA_INCOMPLETE_PLACEHOLDER,
};

/**
 * Decrypt one drive_files row (R3 #2 §1.2). Mutates a shallow copy: populates
 * `name` (from name_encrypted) and `mime` (from mime_claimed for encrypted
 * rows). Plaintext rows pass through unchanged. Per §1.5 lock: per-row
 * failure produces a placeholder name, never throws — preserves the rest of
 * the list.
 */
export async function _decryptDriveFile(item: DriveFile): Promise<DriveFile> {
  if (!item.is_encrypted) return item;
  if (!item.name_encrypted || !item.name_iv || !item.key_wrap) {
    return { ...item, name: SCHEMA_INCOMPLETE_PLACEHOLDER };
  }
  const { masterPrivkey, masterPubkey } = getKeyBundleRef();
  if (!masterPrivkey || !masterPubkey) {
    return { ...item, name: KEYS_MISSING_PLACEHOLDER };
  }
  try {
    const fileKey = await unwrapKey(
      _base64ToBytes(item.key_wrap),
      masterPubkey,
      masterPrivkey,
    );
    const name = await decryptName(
      _base64ToBytes(item.name_encrypted),
      _base64ToBytes(item.name_iv),
      fileKey,
    );
    return {
      ...item,
      name,
      // mime_claimed is the client-hinted mime stored alongside ciphertext;
      // server returns application/octet-stream for encrypted rows. Surface
      // the hint here so UI consumers (icon picker etc.) work transparently.
      mime: item.mime_claimed || item.mime,
    };
  } catch (err) {
    return { ...item, name: DECRYPT_PLACEHOLDER };
  }
}

export async function _decryptDriveFolder(item: DriveFolder): Promise<DriveFolder> {
  if (!item.is_encrypted) return item;
  if (!item.name_encrypted || !item.name_iv || !item.key_wrap) {
    return { ...item, name: SCHEMA_INCOMPLETE_PLACEHOLDER };
  }
  const { masterPrivkey, masterPubkey } = getKeyBundleRef();
  if (!masterPrivkey || !masterPubkey) {
    return { ...item, name: KEYS_MISSING_PLACEHOLDER };
  }
  try {
    const folderKey = await unwrapKey(
      _base64ToBytes(item.key_wrap),
      masterPubkey,
      masterPrivkey,
    );
    const name = await decryptName(
      _base64ToBytes(item.name_encrypted),
      _base64ToBytes(item.name_iv),
      folderKey,
    );
    return { ...item, name };
  } catch (err) {
    return { ...item, name: DECRYPT_PLACEHOLDER };
  }
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
  return _decryptDriveFile(data.file);
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
  // R3 #2 §1.2 batch decrypt — Promise.all preserves order; per-row failures
  // become placeholders (_decryptDriveFile never throws).
  const decrypted = await Promise.all(data.items.map(_decryptDriveFile));
  // R3 #2 §1.4 dual-mode — backend SORTABLE/LIKE skip encrypted rows. If any
  // encrypted rows present, client-side re-sort/re-filter post-decrypt.
  // Caveat: only operates on the current page; cross-page sort/filter is a
  // pagination UX question deferred to R3 #3+ per R2 #2 §3.2 b+a hybrid lock.
  const items = _sortAndFilterEncrypted(decrypted, opts.sort, opts.order, opts.q);
  return { items, meta };
}

export function _sortAndFilterEncrypted(
  items: DriveFile[],
  sort: SortKey | undefined,
  order: SortOrder | undefined,
  q: string | undefined,
): DriveFile[] {
  let out = items;
  const hasEncrypted = out.some((f) => f.is_encrypted);
  if (!hasEncrypted) return out;

  if (q && q.length > 0) {
    const needle = q.toLowerCase();
    out = out.filter((f) => f.name.toLowerCase().includes(needle));
  }
  if ((sort ?? "name") === "name") {
    const dir = order === "desc" ? -1 : 1;
    out = [...out].sort((a, b) => {
      return (
        a.name.localeCompare(b.name, "zh-Hant", {
          sensitivity: "base",
          numeric: true,
        }) * dir
      );
    });
  }
  return out;
}

export async function listFolders(parentId: number | null): Promise<DriveFolder[]> {
  try {
    const resp: any = await driveApi.get("/drive/folders", {
      params: { parent_id: parentId },
    });
    const { data } = unwrapDriveBody<{ items: DriveFolder[] }>(resp.data);
    return Promise.all(data.items.map(_decryptDriveFolder));
  } catch (err) {
    if (is404(err)) return []; // B9 未實作期間，graceful empty
    throw err;
  }
}

export async function getBreadcrumb(folderId: number): Promise<DriveFolder[]> {
  try {
    const resp: any = await driveApi.get(`/drive/folders/${folderId}/breadcrumb`);
    const { data } = unwrapDriveBody<{ breadcrumb: DriveFolder[] }>(resp.data);
    return Promise.all(data.breadcrumb.map(_decryptDriveFolder));
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
    throw new DriveServiceError("FILE_TOO_LARGE", "檔案超過 2GB 限制", {
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

// ───── R3 #3 §1.2: Path B — single-blob encrypted upload (< 50MB) ─────

/**
 * R3 #3 §1.2 Path B — encrypt-then-upload for files < 50MB chunked threshold.
 *
 * Flow per dispatch §1.2:
 *   1. Generate random file_key (32-byte CSPRNG)
 *   2. Read file bytes → encryptBlob → ciphertext + binary_iv
 *   3. encryptName(file.name, file_key) → name_encrypted + name_iv
 *   4. wrapFileKey(file_key, master_pubkey) → key_wrap (X25519 sealed box)
 *   5. POST multipart with E2EE fields (`binary` blob + 4 base64 fields + mime_claimed + is_encrypted)
 *   6. Decrypt returned DriveFile to populate in-memory name (per R3 #2 pattern)
 *
 * binary_iv is a separate multipart field (default-pick: not prepended to
 * ciphertext — explicit field cleaner per Catch 12 raise pending backend ack).
 *
 * AAD: null for blob ciphertext (same pattern as name_encrypted; cross-user
 * binding via key_wrap recipient).
 */
export async function uploadFileEncryptedSingle(args: {
  file: File;
  folderId: number | null;
  onProgress?: (loaded: number, total: number) => void;
  signal?: AbortSignal;
}): Promise<DriveFile> {
  const { file, folderId, onProgress, signal } = args;

  const { masterPubkey } = getKeyBundleRef();
  if (!masterPubkey) {
    throw new DriveServiceError("KEYS_MISSING", "尚未登入或金鑰已失效，請重新登入");
  }
  if (file.size > MAX_SYNC_UPLOAD_BYTES) {
    throw new DriveServiceError("FILE_TOO_LARGE", "檔案超過 2GB 限制", {
      max_bytes: MAX_SYNC_UPLOAD_BYTES,
      actual_bytes: file.size,
    });
  }

  const fileKey = await generateFileKey();
  const plainBytes = new Uint8Array(await file.arrayBuffer());
  const { ciphertext: blobCiphertext, iv: blobIv } = await encryptBlob(plainBytes, fileKey);
  const { ciphertext: nameCiphertext, iv: nameIv } = await encryptName(file.name, fileKey);
  const keyWrap = await wrapFileKey(fileKey, masterPubkey);

  const fd = new FormData();
  fd.append(
    "binary",
    new Blob([blobCiphertext], { type: "application/octet-stream" }),
    "encrypted.bin",
  );
  fd.append("binary_iv", bytesToBase64Helper(blobIv));
  fd.append("name_encrypted", bytesToBase64Helper(nameCiphertext));
  fd.append("name_iv", bytesToBase64Helper(nameIv));
  fd.append("key_wrap", bytesToBase64Helper(keyWrap));
  fd.append("mime_claimed", file.type || "application/octet-stream");
  fd.append("is_encrypted", "1");
  if (folderId != null) fd.append("folder_id", String(folderId));

  const resp: any = await driveApi.post("/drive/files", fd, {
    headers: { "Content-Type": "multipart/form-data" },
    signal,
    onUploadProgress: (e: any) => {
      if (onProgress) onProgress(e.loaded, e.total ?? 0);
    },
  });
  const { data } = unwrapDriveBody<{ file: DriveFile }>(resp.data);
  // Backend returns the row with name_encrypted but not plaintext name —
  // decrypt now so caller gets a ready-to-render DriveFile.
  return _decryptDriveFile(data.file);
}

function bytesToBase64Helper(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// ───── R3 #3 §1.2 + §1.4: Path C — chunked encrypted upload (≥ 50MB) ─────

// R3 #3 default chunk threshold. Files at or above this go chunked.
export const CHUNKED_UPLOAD_THRESHOLD_BYTES = 50 * 1024 * 1024;
// R3 #3 Default 1 — chunk_size 5MB negotiated with backend at initiate.
export const DEFAULT_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

interface InitiateResponse {
  session_id: number;
  chunk_size: number;
  total_chunks: number;
  // Optional resume info if session pre-existed for same content_hash
  received_chunks?: number[];
}

interface ChunkUploadOpts {
  file: File;
  folderId: number | null;
  onProgress?: (phase: "encrypt" | "upload" | "finalize", loaded: number, total: number) => void;
  signal?: AbortSignal;
}

/**
 * R3 #3 §1.2 Path C — chunked encrypted upload for files ≥ 50MB.
 *
 * Flow per dispatch §1.2:
 *   1. Generate file_key + encryptName + wrapFileKey (same as Path B)
 *   2. POST /drive/uploads/initiate with metadata → { session_id, chunk_size, total_chunks }
 *   3. For each chunk i (0..total_chunks-1):
 *      - Slice file bytes [i*chunk_size, (i+1)*chunk_size]
 *      - Encrypt via encryptChunk(plaintext, freshIv, file_key, chunkAad(account, i))
 *      - PUT /drive/uploads/{session_id}/chunks/{i} with { iv, ciphertext }
 *   4. POST /drive/uploads/{session_id}/finalize → returns DriveFile
 *
 * Worker offload (encryptWorkerClient) intentionally NOT wired here yet —
 * jest CJS parser cannot handle import.meta.url at module load; encryptChunk
 * runs sync on main thread per chunk (~10-50ms for 5MB chunk, acceptable for
 * R3 #3 ship; Worker offload as R3 housekeeping candidate per dispatch §1.3
 * future perf optimization).
 *
 * Resume protocol (R3 #3 §1.4) wired in S5 — uses sessionStorage to track
 * in-flight session_id across tab refresh.
 */
export async function uploadFileEncryptedChunked(opts: ChunkUploadOpts): Promise<DriveFile> {
  const { file, folderId, onProgress, signal } = opts;

  const { masterPubkey } = getKeyBundleRef();
  if (!masterPubkey) {
    throw new DriveServiceError("KEYS_MISSING", "尚未登入或金鑰已失效，請重新登入");
  }
  if (file.size > MAX_SYNC_UPLOAD_BYTES) {
    throw new DriveServiceError("FILE_TOO_LARGE", "檔案超過 2GB 限制", {
      max_bytes: MAX_SYNC_UPLOAD_BYTES,
      actual_bytes: file.size,
    });
  }
  const account = _getCurrentAccount();
  if (!account) {
    throw new DriveServiceError("ACCOUNT_MISSING", "找不到 account — 請重新登入");
  }

  const fileKey = await generateFileKey();
  const { ciphertext: nameCiphertext, iv: nameIv } = await encryptName(file.name, fileKey);
  const keyWrap = await wrapFileKey(fileKey, masterPubkey);

  // Step 1: initiate
  const initiateResp: any = await driveApi.post(
    "/drive/uploads/initiate",
    {
      total_size_plaintext: file.size,
      chunk_size: DEFAULT_CHUNK_SIZE_BYTES,
      name_encrypted: bytesToBase64Helper(nameCiphertext),
      name_iv: bytesToBase64Helper(nameIv),
      key_wrap: bytesToBase64Helper(keyWrap),
      mime_claimed: file.type || "application/octet-stream",
      folder_id: folderId,
    },
    { signal },
  );
  const { data: initData } = unwrapDriveBody<InitiateResponse>(initiateResp.data);
  const { session_id, chunk_size, total_chunks, received_chunks = [] } = initData;
  const receivedSet = new Set(received_chunks);

  // Persist session_id for resume (R3 #3 §1.4)
  _persistUploadSession(session_id, file.name, file.size, chunk_size, total_chunks);

  // Step 2: per-chunk encrypt + PUT
  const totalEncryptBytes = file.size;
  let encryptedBytes = 0;
  let uploadedBytes = 0;

  for (let i = 0; i < total_chunks; i++) {
    if (signal?.aborted) {
      throw new DriveServiceError("UPLOAD_ABORTED", "上傳已取消");
    }
    if (receivedSet.has(i)) {
      // Resume — skip already-uploaded chunks
      uploadedBytes += Math.min(chunk_size, file.size - i * chunk_size);
      onProgress?.("upload", uploadedBytes, totalEncryptBytes);
      continue;
    }
    const start = i * chunk_size;
    const end = Math.min(start + chunk_size, file.size);
    const chunkBlob = file.slice(start, end);
    const plaintext = new Uint8Array(await chunkBlob.arrayBuffer());

    const iv = await freshChunkIv();
    const aad = chunkAad(account, i);
    const ciphertext = await encryptChunk(plaintext, iv, fileKey, aad);
    encryptedBytes += plaintext.length;
    onProgress?.("encrypt", encryptedBytes, totalEncryptBytes);

    // Catch 12 final (wiki #1635) — Path C chunk PUT uses raw binary body
    // + X-Chunk-Iv + X-Chunk-Hash headers (multipart parser overhead too
    // expensive for 5MB chunks; backend prefers HTTP-semantic header per
    // R2 #3 §2.1.4 spec lock).
    const chunkHash = await sha256(ciphertext);
    await driveApi.put(
      `/drive/uploads/${session_id}/chunks/${i}`,
      ciphertext,
      {
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Chunk-Iv": bytesToBase64Helper(iv),
          "X-Chunk-Hash": bytesToBase64Helper(chunkHash),
        },
        signal,
      },
    );
    uploadedBytes += plaintext.length;
    onProgress?.("upload", uploadedBytes, totalEncryptBytes);
  }

  // Step 3: finalize
  onProgress?.("finalize", totalEncryptBytes, totalEncryptBytes);
  const finalizeResp: any = await driveApi.post(
    `/drive/uploads/${session_id}/finalize`,
    {},
    { signal },
  );
  const { data: finalData } = unwrapDriveBody<{ file: DriveFile }>(finalizeResp.data);

  // Clear resume state on successful finalize
  _clearUploadSession();

  return _decryptDriveFile(finalData.file);
}

// ───── R3 #3 §1.4: Resume protocol helpers ─────

const UPLOAD_SESSION_KEY = "koatag.uploadSession.v1";

interface PersistedUploadSession {
  session_id: number;
  file_name: string;
  file_size: number;
  chunk_size: number;
  total_chunks: number;
  saved_at: number;
}

export function _persistUploadSession(
  session_id: number,
  file_name: string,
  file_size: number,
  chunk_size: number,
  total_chunks: number,
): void {
  const payload: PersistedUploadSession = {
    session_id,
    file_name,
    file_size,
    chunk_size,
    total_chunks,
    saved_at: Date.now(),
  };
  // sessionStorage — transient, cleared on tab close. Master_key not stored.
  try {
    sessionStorage.setItem(UPLOAD_SESSION_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage may be unavailable (private mode etc.) — non-fatal.
  }
}

export function _clearUploadSession(): void {
  try {
    sessionStorage.removeItem(UPLOAD_SESSION_KEY);
  } catch {
    // non-fatal
  }
}

export function _getPersistedUploadSession(): PersistedUploadSession | null {
  try {
    const raw = sessionStorage.getItem(UPLOAD_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function _getCurrentAccount(): string {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const u = JSON.parse(raw);
    return u.account || u.email || "";
  } catch {
    return "";
  }
}

// R3 #3 §1.6 — install beforeunload guard: if any chunked upload session is
// in flight (persisted in sessionStorage), display browser confirm dialog
//「上傳中，離開會中斷」。 Returns disposer for cleanup on logout / unmount.
export function installUploadBeforeUnloadGuard(): () => void {
  const handler = (e: BeforeUnloadEvent) => {
    if (_getPersistedUploadSession()) {
      // Browser native confirm — returnValue text is mostly ignored by modern
      // browsers (they show their own message), but setting it is required to
      // trigger the dialog.
      e.preventDefault();
      e.returnValue = "上傳中，離開會中斷";
      return e.returnValue;
    }
    return undefined;
  };
  window.addEventListener("beforeunload", handler);
  return () => window.removeEventListener("beforeunload", handler);
}

/**
 * R3 #3 §1.2 — convenience dispatcher. Routes to Path A / B / C based on
 * file size + masterPubkey availability. Caller-facing API; keeps switching
 * logic out of upload UI components.
 */
export async function uploadFileSmart(opts: {
  file: File;
  folderId: number | null;
  onProgress?: (loaded: number, total: number) => void;
  onPhaseProgress?: (
    phase: "encrypt" | "upload" | "finalize",
    loaded: number,
    total: number,
  ) => void;
  signal?: AbortSignal;
  forcePlaintext?: boolean; // Migration window — caller can opt out
}): Promise<DriveFile> {
  const { file, folderId, onProgress, onPhaseProgress, signal, forcePlaintext } = opts;
  const { masterPubkey } = getKeyBundleRef();
  if (forcePlaintext || !masterPubkey) {
    return uploadFile(file, folderId, onProgress, signal);
  }
  if (file.size >= CHUNKED_UPLOAD_THRESHOLD_BYTES) {
    return uploadFileEncryptedChunked({ file, folderId, onProgress: onPhaseProgress, signal });
  }
  return uploadFileEncryptedSingle({
    file,
    folderId,
    onProgress,
    signal,
  });
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
): Promise<PagedResp<TrashedItem>> {
  const params = {
    sort: opts.sort,
    order: opts.order,
    page: opts.page ?? 1,
    size: opts.size ?? 30,
  };
  try {
    // R3 #6 §1.1 — backend §3.2 unified file+folder trash list. Endpoint
    // path tentative; tries /drive/trash first then falls back to legacy
    // /drive/files/trash for backwards-compat during R3 #6 dual-mode window.
    let resp: any;
    try {
      resp = await driveApi.get("/drive/trash", { params });
    } catch (err) {
      if (is404(err)) {
        resp = await driveApi.get("/drive/files/trash", { params });
      } else {
        throw err;
      }
    }
    const { data, meta } = unwrapDriveBody<{ items: TrashedItem[] }>(resp.data);

    // R3 #6 §1.1 batch decrypt — dispatch to _decryptDriveFile or
    // _decryptDriveFolder per resource_type discriminator. Legacy backend
    // (no resource_type field) defaults to 'file' for backward compat.
    const decrypted: TrashedItem[] = await Promise.all(
      data.items.map(async (item) => {
        const rtype = item.resource_type ?? "file";
        if (rtype === "folder") {
          return {
            ...(await _decryptDriveFolder(item as TrashedFolder)),
            resource_type: "folder" as const,
          } as TrashedFolder;
        }
        return {
          ...(await _decryptDriveFile(item as TrashedFile)),
          resource_type: "file" as const,
        } as TrashedFile;
      }),
    );
    return { items: decrypted, meta };
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

// ───── R3 #6 §1.3: folder cascade restore + cascade-preview helpers ─────

export interface CascadeRestorePreview {
  files_count: number;
  folders_count: number;
}

export interface CascadeDeletePreview {
  files_count: number;
  folders_count: number;
  share_links_count: number;
  size_bytes: number;
}

/**
 * R3 #6 §1.3 (per backend §1.8 cascade-preview endpoint) — peek at the
 * cascade size before confirming hard-delete. Used by HardDeleteConfirmDialog
 * to display「永久刪除 N 個檔案 + M 個資料夾 + K 個分享連結 (X MB)」.
 *
 * UI rendering deferred to R3 housekeeping per dispatch §1.2 scope plan.
 */
export async function cascadePreviewDelete(
  folderId: number,
): Promise<CascadeDeletePreview> {
  const resp: any = await driveApi.get(
    `/drive/folders/${folderId}/cascade-preview-delete`,
  );
  const { data } = unwrapDriveBody<CascadeDeletePreview>(resp.data);
  return data;
}

/**
 * R3 #6 §1.3 — peek at cascade size before confirming folder restore.
 */
export async function cascadePreviewRestore(
  folderId: number,
): Promise<CascadeRestorePreview> {
  const resp: any = await driveApi.get(
    `/drive/folders/${folderId}/cascade-preview-restore`,
  );
  const { data } = unwrapDriveBody<CascadeRestorePreview>(resp.data);
  return data;
}

/**
 * R3 #6 §1.3 — atomic folder restore (cascade per backend §1.1). Backend
 * undoes the soft-delete for the folder + all descendant folders + files
 * in a single transaction.
 */
export async function restoreFolder(folderId: number): Promise<DriveFolder> {
  const resp: any = await driveApi.post(`/drive/folders/${folderId}/restore`);
  const { data } = unwrapDriveBody<{ folder: DriveFolder }>(resp.data);
  return data.folder;
}

/**
 * R3 #6 §1.2 — atomic folder permanent delete (cascade). Backend cascades
 * permanent delete to all descendants + revokes related shares + releases
 * storage bytes. Critically: encryption keys are unrecoverable post-delete
 * (per dispatch §1.2 hint「即使工程師也無法救回」).
 */
export async function permanentDeleteFolder(
  folderId: number,
): Promise<{ released_bytes: number }> {
  const resp: any = await driveApi.delete(`/drive/folders/${folderId}`, {
    params: { permanent: 1 },
  });
  const { data } = unwrapDriveBody<{ released_bytes: number }>(resp.data);
  return data;
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
