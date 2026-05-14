# KOATAG Drive — Frontend Spec

> 三方共識討論產出之一
> 對應：koatag backend spec（`KOATAG/CLOUD_DRIVE_BACKEND_SPEC.md` 實質 v1.5）+ wiki 8 篇 reference（含 監軍角色SOP）
> 最終會與 backend spec 彙整成 `CLOUD_DRIVE_SPEC.md`
> 狀態：v1.2 (post-MVP — Phase 1/2A/2B/2C + v3 video onError + v?-zip landing 全 done，2026-05-14)
> 對應 wiki 監軍對齊報告：`life_wiki/wiki/output/koatag-drive-alignment-2026-05-14.md`

---

## 0. 範圍與基線

- 對象：在 KOATAG 既有前端（React + TS + Tailwind，feat/redesign-v3 分支）內加 Drive feature
- 整合：sidebar 新增「Drive」entry，與既有 image / tag area 並存不衝突
- IDOR fix 配合：Drive endpoint 不帶 `{user_id}` path param；既有 image-related service 同步改（從 JWT 取 user_id）
- API 回應格式：統一 `{ok, data}` / `{ok:false, error:{code,message,details}}`，axios interceptor 自動解包 + throw `DriveServiceError`

---

## 1. Pages / Routes

### 1.1 Route 表

| Route | 用途 | MVP | 對應 component |
|---|---|---|---|
| `/drive` | Drive 根 | ✅ | `DrivePage` (folderId=null) |
| `/drive/folder/:id` | 子資料夾 | ✅ | `DrivePage` (folderId=:id) |
| `/drive/file/:id` | 單檔詳情 / preview | ✅ | `DriveFilePage` |
| `/drive/shared/in` | 共享給我的 | v3 | `SharedWithMePage` |
| `/drive/shared/out` | 我共享的 | v3 | `MySharesPage` |
| `/drive/share/:token` | public share link landing | v3 | `ShareLinkLandingPage` |

### 1.2 整合方式

- `DrivePage` 與 `DriveFilePage` lazy load：`const DrivePage = lazy(() => import('@/pages/DrivePage'))`
- Route guard：使用既有 `requireAuth`（drive 全部需登入；share link landing 例外，靠 token 驗）
- File 結構：
  ```
  src/pages/DrivePage/
    DrivePage.tsx
    DrivePage.module.css
    index.ts
  src/pages/DriveFilePage/
    DriveFilePage.tsx
    ...
  ```

---

## 2. Components

### 2.1 `DrivePage`

```ts
interface DrivePageProps {} // 路由 param 走 useParams<{ id?: string }>
```

**佈局**：
- 頂列：`Breadcrumb` + `SearchBar` + `SortMenu` + view toggle (grid/list)
- 主區：`FileGrid` 或 `FileList`
- 整頁 overlay：`UploadDropzone`（drag over 顯示提示）
- 浮動底欄：`UploadProgressList`（佇列有東西時才顯示）

**state hook**：
- `useFolderTreeStore()` — currentFolderId / breadcrumb / 列表資料
- `useUploadQueueStore()` — 上傳佇列
- `useDriveQuotaStore()` — 配額（render 完 useEffect 觸發 fetch）

### 2.2 `Breadcrumb`

```ts
interface BreadcrumbProps {
  ancestors: DriveFolder[]; // root → current（不含 root，root 用 home icon）
  onNavigate: (folderId: number | null) => void; // null = 回根
}
```
- 渲染：`🏠 / FolderA / FolderB`
- 過長省略：中段 `...` 點擊展開全路徑

### 2.3 `FileGrid` / `FileList`

```ts
interface FileListPanelProps {
  folders: DriveFolder[];
  files: DriveFile[];
  view: 'grid' | 'list';
  onItemOpen: (item: DriveFile | DriveFolder) => void;
  onItemContextMenu: (item, evt: React.MouseEvent) => void;
}
```
- Grid：CSS Grid，固定 card 寬 160px，圖片 mime 走 `thumb_path` fallback `/api/drive/files/{id}/thumb`
- List：table 5 欄（icon / 名稱 / 大小 / 修改時間 / 動作），sticky header

### 2.4 `FileCard` / `FolderCard`

```ts
interface FileCardProps {
  file: DriveFile;
  view: 'grid' | 'list';
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}
```

**mime → icon 對應策略**：
| mime prefix | 渲染 |
|---|---|
| `image/*` | `<img src={thumb_url}>`（thumb_path or `thumbUrl(id)` = `/api/drive/files/{id}/thumb`） |
| `video/*` | 影片 icon（v2 加 poster frame） |
| `application/pdf` | PDF icon |
| 其他 | 通用檔案 icon |

- name：超過寬度截斷 + tooltip 顯示完整
- 同名衝突：靠後端決議（接受重名，前端不去重；顯示後端回的 name 即可）

### 2.5 `UploadDropzone`

```ts
interface UploadDropzoneProps {
  folderId: number | null;
  children: React.ReactNode; // wrap whole DrivePage
}
```
- 基於 `react-dropzone`
- 行為：onDrop → for each File:
  1. `file.size > 50 * 1024 * 1024` → enqueue with `status='error', code='FILE_TOO_LARGE'`，不送 server
  2. else → enqueue with `status='pending'`
- 視覺：drag over 整頁淡藍 overlay + 「拖入以上傳到當前資料夾」

### 2.6 `UploadProgressList`

- 從 `uploadQueueStore` 讀；佇列空 → 不渲染
- 列表項：name | progress bar (0-100) | status icon | cancel/retry button
- 收合：右上 toggle 按鈕，預設展開

### 2.7 `SortMenu`

```ts
type SortKey = 'name' | 'size' | 'mtime' | 'type';
type SortOrder = 'asc' | 'desc';

interface SortMenuProps {
  sort: SortKey;
  order: SortOrder;
  onChange: (sort: SortKey, order: SortOrder) => void;
}
```
- UI：dropdown，4 個 sort key + asc/desc toggle
- 排序由後端做（前端只送 query param），前端不二次排序

### 2.8 `SearchBar`

```ts
interface SearchBarProps {
  query: string;
  onQueryChange: (q: string) => void;
}
```
- debounce 300ms，按 Enter 立即觸發
- 觸發 `searchFiles(query, ...)`，搜尋結果顯示時隱藏 folder 區（純檔列表 + 結果計數）
- query 為空 → 回到 `listFolder(currentFolderId)`

### 2.9 `QuotaIndicator`

```ts
interface QuotaIndicatorProps {} // 從 store 讀
```
- 位置：sidebar 底部固定
- 顯示：`progress bar` + 文字 `1.2 / 5 GB（24%）`
- 顏色閾值：< 80% gray / 80-99% yellow / 100% red
- 100% 時：upload button disabled + tooltip「容量已滿」（後端仍 deny 把關）

### 2.10 `ContextMenu`

```ts
type ContextMenuAction = 'open' | 'rename' | 'move' | 'delete' | 'share' | 'download';

interface ContextMenuProps {
  item: DriveFile | DriveFolder;
  position: { x: number; y: number };
  onClose: () => void;
  onAction: (action: ContextMenuAction) => void;
}
```
- 觸發：右鍵 / long-press（mobile）
- 動作差異：folder 沒有 download；MVP 沒有 share（v3 才開）

### 2.11 `ImageLightbox` 適配

重用 `src/components/image_area` 既有 viewer（CSS overlay + Magnifier loupe，已 land）。

**Adapter**：
```ts
import { streamUrl, thumbUrl } from '@/services/driveService';

function driveFileToImageProps(file: DriveFile) {
  return {
    src: streamUrl(file.id),
    thumbSrc: file.thumb_path ? thumbUrl(file.id) : streamUrl(file.id),
    alt: file.name,
  };
}
```

### 2.12 `VideoPlayer`

```tsx
import { streamUrl } from '@/services/driveService';

function VideoPlayer({ fileId, name }: { fileId: number; name: string }) {
  return (
    <video
      controls
      preload="metadata"
      src={streamUrl(fileId)}
      style={{ maxWidth: '100%', maxHeight: '80vh' }}
    >
      您的瀏覽器不支援 video 標籤
    </video>
  );
}
```
- 瀏覽器 native Range request 直接打 backend（dev: BinaryFileResponse / prod: nginx X-Accel-Redirect，見 §6）
- `preload="metadata"` 只下載 header
- v2 加 poster：`<video poster={`/api/drive/files/${id}/poster.jpg`}>`（poster endpoint v2 才會在 backend spec 加）

---

## 3. Service Layer

> 與 backend spec §3 routes + §9 error codes 對齊。

### 3.0 命名邊界（snake_case ↔ camelCase）

**契約**：API body / query string 一律 **snake_case**（backend Laravel 慣例）。

**前端機制**：選 **(a) service 層手動轉換**（[koatag msg #156 確認](#) defer 給 frontend 決定，wiki 傾向 (b)，我選 (a)）。

理由：
- 透明：service signature 一目了然 `body: { resource_type: ..., grantee_id: ... }`
- 零依賴：不引 axios case converter
- KOATAG 是 solo project，避免 magic conversion 將來除錯困難
- service 層只 ~10 個 endpoint，手動成本低

**例外（不轉）**：
- `error.code`：SCREAMING_SNAKE_CASE，前後端共用 i18n key（不轉）
- `audit` event name：`drive.upload.success` 等（不轉）
- 資源 id：`123`（純值，無 case）
- response 內的 model 欄位：`size_bytes`, `created_at` 等保持 snake_case（TS interface 直接用 snake_case property name，避免 conversion 邊界錯位）

**TS interface 風格**：
- function param / local variable / state shape：camelCase（TS 慣例）
- response model 欄位：snake_case（直接對應後端 JSON）
- API body 出去前在 service 內構造 snake_case object

### 3.1 型別定義

```ts
// src/services/driveService.ts
import axios from '@/services/axios';

export interface DriveFile {
  id: number;
  owner_id: number;
  folder_id: number | null;
  name: string;
  mime: string;
  size_bytes: number;
  checksum_sha1: string;
  thumb_path: string | null;
  created_at: string; // ISO 8601
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
  ratio: number; // 0-1
}

// 對齊 backend `{ok, data:{items:[]}, meta:{...}}`
export interface PagedResp<T> {
  items: T[];
  meta: {
    total: number;
    page: number;
    size: number;       // ⚠️ 不是 page_size
    total_pages: number;
  };
}

// 後端 sort 走 DB 欄位名（前端 SortMenu UI label 自己對映）
export type SortKey = 'name' | 'size_bytes' | 'created_at' | 'updated_at';
export type SortOrder = 'asc' | 'desc';

// helper：UI label → backend key
export const SORT_LABELS: Record<SortKey, string> = {
  name: '名稱',
  size_bytes: '檔案大小',
  created_at: '建立時間',
  updated_at: '修改時間',
};
```

### 3.2 列表 / 導航

> backend 把 list / breadcrumb 拆成多個 endpoint，前端用 `Promise.all` 一次抓三筆。

```ts
// 列檔（單頁，後端走 offset 分頁，size cap 200）
export async function listFiles(opts: {
  folderId: number | null;
  sort?: SortKey;
  order?: SortOrder;
  q?: string;
  page?: number;
  size?: number; // default 30, cap 200
}): Promise<PagedResp<DriveFile>> {
  const params = {
    folder_id: opts.folderId,
    sort: opts.sort ?? 'name',
    order: opts.order ?? 'asc',
    q: opts.q,
    page: opts.page ?? 1,
    size: opts.size ?? 30,
  };
  const { data } = await axios.get('/api/drive/files', { params });
  return { items: data.data.items, meta: data.meta };
}

// 列子資料夾（不分頁；資料夾數量小）
export async function listFolders(parentId: number | null): Promise<DriveFolder[]> {
  const { data } = await axios.get('/api/drive/folders', {
    params: { parent_id: parentId },
  });
  return data.data.items;
}

// 麵包屑：root → current（recursive CTE 查祖先）
export async function getBreadcrumb(folderId: number): Promise<DriveFolder[]> {
  const { data } = await axios.get(`/api/drive/folders/${folderId}/breadcrumb`);
  return data.data.breadcrumb;
}

// facade：一次抓「進入資料夾」需要的全部資料
export async function loadFolderView(folderId: number | null, opts: {
  sort?: SortKey;
  order?: SortOrder;
  q?: string;
  page?: number;
  size?: number;
} = {}): Promise<{
  folders: DriveFolder[];
  files: PagedResp<DriveFile>;
  breadcrumb: DriveFolder[];
}> {
  const [folders, files, breadcrumb] = await Promise.all([
    listFolders(folderId),
    listFiles({ folderId, ...opts }),
    folderId != null ? getBreadcrumb(folderId) : Promise.resolve([]),
  ]);
  return { folders, files, breadcrumb };
}
```

### 3.3 CRUD

```ts
export async function uploadFile(
  file: File,
  folderId: number | null,
  onProgress: (loaded: number, total: number) => void,
): Promise<DriveFile> {
  if (file.size > 50 * 1024 * 1024) {
    throw new DriveServiceError('FILE_TOO_LARGE', '檔案超過 50MB 限制', {
      max_bytes: 50 * 1024 * 1024,
      actual_bytes: file.size,
    });
  }
  const fd = new FormData();
  fd.append('file', file);
  if (folderId != null) fd.append('folder_id', String(folderId));
  const { data } = await axios.post('/api/drive/files', fd, {
    onUploadProgress: e => onProgress(e.loaded, e.total ?? 0),
  });
  return data.data.file;
}

// 下載 / 串流 URL — 兩個用途共用 endpoint，靠 query 切 Content-Disposition
export function streamUrl(fileId: number): string {
  // for inline <video> / <img> — 不帶 ?download，瀏覽器顯示
  return `/api/drive/files/${fileId}/download`;
}

export function downloadUrl(fileId: number): string {
  // for <a download> click — 加 ?download=1 觸發 attachment
  return `/api/drive/files/${fileId}/download?download=1`;
}

export function thumbUrl(fileId: number): string {
  return `/api/drive/files/${fileId}/thumb`;
}

export async function deleteFile(fileId: number): Promise<void> {
  await axios.delete(`/api/drive/files/${fileId}`);
}

export async function createFolder(name: string, parentId: number | null): Promise<DriveFolder> {
  const { data } = await axios.post('/api/drive/folders', { name, parent_id: parentId });
  return data.data.folder;
}

export async function deleteFolder(folderId: number): Promise<void> {
  await axios.delete(`/api/drive/folders/${folderId}`);
}

export async function renameOrMove(opts: {
  resourceType: 'file' | 'folder';
  resourceId: number;
  newName?: string;
  targetFolderId?: number | null;
}): Promise<void> {
  const base = opts.resourceType === 'file' ? '/api/drive/files' : '/api/drive/folders';
  const body: Record<string, unknown> = {};
  if (opts.newName !== undefined) body.name = opts.newName;
  if (opts.targetFolderId !== undefined) {
    body[opts.resourceType === 'file' ? 'folder_id' : 'parent_id'] = opts.targetFolderId;
  }
  await axios.patch(`${base}/${opts.resourceId}`, body);
}
```

### 3.4 Quota

```ts
export async function getQuota(): Promise<DriveQuota> {
  const { data } = await axios.get('/api/drive/quota');
  return data.data.quota;
}
```

### 3.5 Share / Share Link（v3）

> 詳細實作 v3 才展開。signature 列出供 spec freeze。
> camelCase param → snake_case body 在 service 函式內轉（依 §3.0）。

```ts
// 範例展示 §3.0 (a) 手動轉 pattern
export async function createShare(opts: {
  resourceType: 'file' | 'folder';
  resourceId: number;
  granteeId: number;
  permission: 'read' | 'write'; // MVP 後端只接受 'read'
  expiresAt?: string; // ISO 8601
}): Promise<{ id: number }> {
  const { data } = await axios.post('/api/drive/shares', {
    resource_type: opts.resourceType,
    resource_id: opts.resourceId,
    grantee_id: opts.granteeId,
    permission: opts.permission,
    expires_at: opts.expiresAt,
  });
  return data.data.share;
}

export async function listIncomingShares(): Promise<Array<{ /* ... */ }>>; // GET /api/drive/shares/incoming
export async function listOutgoingShares(): Promise<Array<{ /* ... */ }>>; // GET /api/drive/shares/outgoing
export async function revokeShare(shareId: number): Promise<void>;          // DELETE /api/drive/shares/{id}

export async function createShareLink(opts: {
  resourceType: 'file' | 'folder';
  resourceId: number;
  permission: 'read' | 'write';
  expiresAt?: string;
  maxUses?: number;
}): Promise<{ id: number; token: string }>;

export async function listMyShareLinks(): Promise<Array<{ /* ... */ }>>;    // GET /api/drive/share-links/outgoing
export async function revokeShareLink(linkId: number): Promise<void>;       // DELETE /api/drive/share-links/{id}

// 公開存取（無 auth）
export function publicAccessUrl(token: string): string {
  return `/api/p/${token}`;
}
export function publicDownloadUrl(token: string): string {
  return `/api/p/${token}/download`;
}
```

### 3.6 `DriveServiceError`

```ts
export class DriveServiceError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'DriveServiceError';
  }
}
```

### 3.7 axios interceptor 統一解包

```ts
// src/services/axios.ts
axios.interceptors.response.use(
  response => {
    const body = response.data;
    if (body && typeof body === 'object' && 'ok' in body && body.ok === false) {
      const err = body.error ?? {};
      return Promise.reject(new DriveServiceError(
        err.code ?? 'UNKNOWN',
        err.message ?? 'Unknown error',
        err.details,
      ));
    }
    // 成功：service 自己解 data / meta，interceptor 不解包（避免破壞既有 image/tag service）
    return response;
  },
  error => {
    if (error.response?.data?.error) {
      const e = error.response.data.error;
      return Promise.reject(new DriveServiceError(e.code, e.message, e.details));
    }
    return Promise.reject(error);
  },
);
```

---

## 4. Error Code Mapping（對齊 backend spec §9，23 個 codes）

```ts
// src/services/errorMap.ts
import { DriveServiceError } from './driveService';

// 23 個 codes，對齊 KOATAG/CLOUD_DRIVE_BACKEND_SPEC.md §9
const driveErrorMessages: Record<string, string> = {
  // 認證 / 授權
  UNAUTHORIZED: '請先登入',
  FORBIDDEN: '沒有權限存取此資源',
  IDOR_DENIED: '安全性檢查未通過',
  // 資源不存在
  NOT_FOUND: '資源不存在',
  FILE_NOT_FOUND: '檔案不存在或已刪除',
  FOLDER_NOT_FOUND: '資料夾不存在',
  // 上傳限制
  FILE_TOO_LARGE: '檔案超過 50MB 限制',
  INVALID_MIME: '不支援的檔案類型',
  QUOTA_EXCEEDED: '您的 Drive 容量已滿，請刪除部分檔案',
  UPLOAD_NO_FILE: '請選擇要上傳的檔案',
  UPLOAD_FAILED: '上傳失敗，請稍後再試',
  // 樹結構操作
  FOLDER_NOT_EMPTY: '資料夾不為空，請先清空',
  MOVE_INTO_DESCENDANT: '不能將資料夾移到自己的子目錄',
  INVALID_PARENT: '父資料夾不存在或無權限',
  // 命名
  NAME_REQUIRED: '請輸入名稱',
  NAME_TOO_LONG: '名稱長度超過 255 字元',
  // 分享
  SHARE_SELF: '不能分享給自己',
  SHARE_DUPLICATE: '此資源已分享給該使用者',
  // Share Link
  SHARE_LINK_EXPIRED: '此分享連結已過期',
  SHARE_LINK_REVOKED: '此分享連結已被撤銷',
  SHARE_LINK_USED_UP: '此分享連結已達使用次數上限',
  SHARE_LINK_INVALID: '分享連結不存在',
  // 兜底
  INTERNAL_ERROR: '系統錯誤，請稍後再試',
};

export function mapDriveError(err: unknown): string {
  if (err instanceof DriveServiceError) {
    return driveErrorMessages[err.code] ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return '發生未知錯誤';
}

// for 結構化 UI（quota 顯示剩餘、超過上限顯示具體大小）
export function getDriveErrorDetails(err: unknown): {
  code: string;
  message: string;
  details?: Record<string, unknown>;
} | null {
  if (err instanceof DriveServiceError) {
    return {
      code: err.code,
      message: driveErrorMessages[err.code] ?? err.message,
      details: err.details as Record<string, unknown> | undefined,
    };
  }
  return null;
}
```

### 4.1 details 欄位對應（給 UI 動態顯示）

| code | details fields | UI 用途 |
|---|---|---|
| `FILE_TOO_LARGE` | `max_bytes, actual_bytes` | toast「實際 X MB / 上限 50 MB」 |
| `QUOTA_EXCEEDED` | `quota_bytes, used_bytes, attempted_bytes` | dialog「需要 X MB / 剩餘 Y MB」 |
| `MOVE_INTO_DESCENDANT` | `folder_id, target_parent_id` | 顯示具體 folder name |
| `FOLDER_NOT_EMPTY` | `folder_id, child_count` | 「該資料夾還有 N 個項目」 |
| `NAME_TOO_LONG` | `max, actual` | 顯示限制 + 實際長度 |
| `SHARE_LINK_USED_UP` | `max_uses, use_count` | 顯示限額 |
| `INTERNAL_ERROR` | `trace_id` | 給使用者回報用 |

---

## 5. Upload Flow

### 5.1 State Machine

```
[idle]
  → user select / drop files
  → for each File:
    [validate]  ⚠️ 必須在 enqueue 前完成，size > 50MB 直接 reject，禁止送 axios
      size > 50MB → enqueue { status: 'error', code: 'FILE_TOO_LARGE' }
      else        → enqueue { status: 'pending' }
  → scheduler: 拉 pending → max 3 concurrent → status='uploading'
    → uploadFile + onProgress (每 200ms throttle 更新 store)
      → 200 OK: status='done', data=DriveFile
      → reject:  status='error', code=err.code, message=err.message
[done] / [error]
  → user 可 retry error / clearDone()
  → 全 done 後保留 5 分鐘自動 cleanup
```

**Contract**：50MB guard 是 **client-side 預阻擋**，目的是「不浪費上傳頻寬」。後端仍有 `FILE_TOO_LARGE` 把關（防偽前端），兩層 defense in depth。e2e §13.2 S2 對應驗證「無 axios 請求送出」。

### 5.2 `UploadQueueStore` (zustand)

```ts
// src/stores/uploadQueueStore.ts
interface UploadItem {
  id: string; // local UUID
  file: File;
  folderId: number | null;
  status: 'pending' | 'uploading' | 'done' | 'error';
  progress: number; // 0-100
  errorCode?: string;
  errorMessage?: string;
  result?: DriveFile;
  abortController?: AbortController;
}

interface UploadQueueStore {
  queue: UploadItem[];
  enqueue: (file: File, folderId: number | null) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  clearDone: () => void;
  // internal scheduler 由 hook 啟動，store 只放狀態
}
```

### 5.3 並行控制 hook

```ts
// src/hooks/useUploadScheduler.ts
function useUploadScheduler() {
  const { queue, ... } = useUploadQueueStore();
  useEffect(() => {
    const uploading = queue.filter(q => q.status === 'uploading').length;
    const slots = 3 - uploading;
    if (slots <= 0) return;
    const pending = queue.filter(q => q.status === 'pending').slice(0, slots);
    pending.forEach(item => start(item));
  }, [queue]);
}
```
掛在 `App.tsx` root，全程運作。

---

## 6. Video Player

見 §2.12，已展開。

**測試重點**：瀏覽器 dev tools Network → 拖時間軸 → 應看到多個 `206 Partial Content` 回應。

**dev / prod 對前端無感**：backend 用 `DRIVE_USE_X_ACCEL` env 切：
- dev (`docker-compose.yml`, `php artisan serve`): Laravel `BinaryFileResponse` 處理 Range
- prod (`docker-compose.nxgin.yml`, nginx): `X-Accel-Redirect` 走 nginx internal location

兩種模式下 header（`Content-Type`, `Content-Disposition`, `Accept-Ranges`, `206 Partial Content`）行為一致，frontend `<video>` 照打 `streamUrl(fileId)` 即可。

---

## 7. Image Lightbox

見 §2.11，已展開。

---

## 8. Sidebar 整合

### 8.1 Menu entry

`src/components/Sidebar/MenuList.tsx`（依現有檔案結構）新增 entry：
```tsx
{ icon: 'cloud', label: 'Drive', path: '/drive' }
```
- icon 走既有 SVG 系統（見 `reference_icons_pending.md`）
- 若 cloud icon 缺 → placeholder 等 Step 4 一起補

### 8.2 QuotaIndicator 掛位置

sidebar 底部固定位置，從 `driveQuotaStore` 讀。
- mount 時觸發 `fetch()`
- 每次 upload/delete success → store invalidate + 重抓

---

## 9. IDOR fix 配合 — ⚠️ 認知更正

> **原本以為現有 image endpoint 有 IDOR 漏洞需要修，verify 後發現不是。**
> backend 在 `JwtMiddleware.php` 第 28-39 行已經攔截 `path.user_id !== JWT.user_id` 的請求並回 403 + audit `access.denied`。

### 9.1 對 frontend 的真正影響：MVP 零改動

- ❌ 不需要改 image / tag service 移除 user_id path param
- ❌ 不需要新增 middleware 配合
- ✅ 既有 `imageService.ts` / `tagService.ts` MVP **完全不動**，IDOR 已被 backend middleware 涵蓋

### 9.2 v3 才做的「URL hygiene」（不是 security fix）

v3 規劃時 backend 會：
- 移除 image route 的 `{user_id}` path param
- Controllers 改讀 `request()->attributes->get('auth_user_id')`
- 統一 image endpoint 為 `{ok, data}` / `{ok:false, error:{...}}` 回應格式

frontend 那時要配合改的事：
- `imageService.ts` / `tagService.ts` 移除 user_id 參數
- 統一錯誤處理 — 跑同一條 `DriveServiceError` 路徑（rename 為 `ApiError` 或維持當前 class，命名 v3 再決）
- 同步刪除 `useAuth()` 取 user_id 後傳 service 的 dead code

### 9.3 Drive endpoint 本來就乾淨

新的 `/api/drive/*` routes 全部不帶 `{user_id}`（見 §3 routes），service 不傳 user_id，後端從 JWT 取。這是 baseline，無 IDOR 工作量。

### 9.4 `useAuthUserId` hook（如需要）

```ts
export function useAuthUserId(): number | null {
  const { user } = useAuth();
  return user?.id ?? null;
}
```

只在 UI 顯示「我的 X」之類資訊時用，**不傳給 service**（service 信任 token）。

---

## 10. Dependencies

### 10.1 `package.json` 新增
```json
{
  "dependencies": {
    "react-dropzone": "^14.2.3",
    "zustand": "^4.5.0"
  }
}
```

### 10.2 不引清單
- video.js / hls.js — MVP 用 native `<video>`
- chonky / filerobot — 用 native primitives + Tailwind 客製
- tus-js-client — v4 才會評估

---

## 11. State Management

全部用 zustand。

### 11.1 `folderTreeStore`
```ts
interface FolderTreeStore {
  currentFolderId: number | null;
  folders: DriveFolder[];
  files: DriveFile[];
  breadcrumb: DriveFolder[];
  loading: boolean;
  setCurrent: (id: number | null) => Promise<void>; // 觸發 listFolder + 更新狀態
  invalidate: () => void; // 重抓當前
}
```

### 11.2 `driveQuotaStore`
```ts
interface DriveQuotaStore {
  quota: DriveQuota | null;
  loading: boolean;
  fetch: () => Promise<void>;
  invalidate: () => void;
}
```

### 11.3 `uploadQueueStore`
見 §5.2

---

## 12. MVP Exclusion List（同 koatag）

- ❌ Write permission 共享（v3）
- ❌ Chunked / resumable upload（v4，目前 50MB 硬拒）
- ❌ HLS / 多碼率影片（v3）
- ❌ Video poster frame（v2）
- ❌ 全文搜尋（v4，MVP 只檔名 LIKE）
- ❌ image_data_id 對應（v2 alter）
- ❌ Share link landing page（v3）

---

## 13. Playwright e2e Plan

### 13.1 Setup
- fixture user：`test-drive@example.com`，quota 100MB（test isolation）
- `beforeEach`：清空該 user 的 drive_files / drive_folders（test API 或 DB seed）

### 13.2 Scenarios

#### S1: 上傳 1MB 圖片
```ts
test('upload 1MB image', async ({ page }) => {
  await page.goto('/drive');
  await page.locator('input[type=file]').setInputFiles('fixtures/1mb.jpg');
  await expect(page.locator('[data-testid=file-card]')).toContainText('1mb.jpg');
  await expect(page.locator('[data-testid=quota-indicator]')).toContainText(/1\.\d+ MB/);
});
```

#### S2: 60MB 上傳被前端 reject
```ts
test('reject > 50MB upload', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', r => requests.push(r.url()));
  await page.goto('/drive');
  await page.locator('input[type=file]').setInputFiles('fixtures/60mb.bin');
  await expect(page.locator('[data-testid=upload-error]')).toContainText('超過 50MB');
  expect(requests.filter(u => u.includes('/api/drive/files'))).toHaveLength(0);
});
```

#### S3: 建資料夾 + 進入 + 上傳
```ts
test('create folder + enter + upload', async ({ page }) => {
  await page.goto('/drive');
  await page.click('[data-testid=create-folder-btn]');
  await page.fill('[data-testid=folder-name-input]', 'TestFolder');
  await page.click('[data-testid=confirm-btn]');
  await page.click('[data-testid=folder-card-TestFolder]');
  await expect(page.locator('[data-testid=breadcrumb]')).toContainText('TestFolder');
  await page.locator('input[type=file]').setInputFiles('fixtures/1mb.jpg');
  await expect(page.locator('[data-testid=file-card]')).toContainText('1mb.jpg');
});
```

#### S4: 重命名 / 移動 / 軟刪
```ts
test('rename / move / soft delete', async ({ page }) => {
  // ... rename, assert name updated
  // ... move, assert folder_id changed (via re-list)
  // ... delete, assert removed from listing, quota unchanged (soft delete keeps bytes)
});
```

#### S5: 同名檔上傳
```ts
test('duplicate names co-exist', async ({ page }) => {
  await page.goto('/drive');
  await page.locator('input[type=file]').setInputFiles('fixtures/1mb.jpg');
  await page.locator('input[type=file]').setInputFiles('fixtures/1mb.jpg'); // 同檔再上傳
  const cards = await page.locator('[data-testid=file-card]').count();
  expect(cards).toBe(2);
});
```

#### S6: 影片 Range request
```ts
test('video range requests', async ({ page }) => {
  const responses: { url: string; status: number }[] = [];
  page.on('response', r => responses.push({ url: r.url(), status: r.status() }));
  await page.goto(`/drive/file/${videoFileId}`);
  await page.locator('video').evaluate((v: HTMLVideoElement) => {
    v.currentTime = 60;
  });
  await page.waitForTimeout(2000);
  const range = responses.filter(r => r.url.includes('/download') && r.status === 206);
  expect(range.length).toBeGreaterThan(0);
});
```

#### S7: lightbox 重用 image_area 行為
```ts
test('lightbox magnifier loupe', async ({ page }) => {
  await page.goto(`/drive/file/${imageFileId}`);
  await page.click('[data-testid=enter-lightbox]');
  await expect(page.locator('[data-testid=lightbox-overlay]')).toBeVisible();
  await page.hover('[data-testid=lightbox-image]');
  await expect(page.locator('[data-testid=magnifier-loupe]')).toBeVisible();
});
```

### 13.3 PR smoke set
每次 PR 跑 S1, S3, S6（最重要 happy path）。

---

## 14. 開放問題

### 14.1 已 koatag 預答 ✅

| # | 問題 | 答 |
|---|---|---|
| 1 | listFiles 分頁：cursor vs offset | **offset**（MVP 規模小，cursor 過度設計） |
| 2 | sort case-insensitive | **是**（MySQL `utf8mb4_unicode_ci` 預設） |
| 3 | 分頁 query param 名稱 | `?page=&size=`（cap 200，**不是** `per_page`） |
| 4 | sort 欄位名稱 | DB 欄位：`name | size_bytes | created_at | updated_at` |
| 5 | 上傳 response shape | `{ok:true, data:{file:{...}}}` |
| 6 | download 是 redirect 還是 200 | **200 + X-Accel-Redirect header**（瀏覽器看不出） |
| 7 | breadcrumb 結構 | `{ok:true, data:{breadcrumb:[{id, name}, ...]}}` root → leaf |
| 8 | share link 公開 URL | `/api/p/{token}` + `/api/p/{token}/download` |

### 14.2 全部已關閉 ✅

| # | 問題 | 答 |
|---|---|---|
| 1 | `download` endpoint 是否用 `?download=1` 切 attachment | ✅ 是（msg #149 + spec §3.1） |
| 2 | file 移到別 user 共享的 folder 是否允許 | ✅ MVP 不支援 |
| 3 | 多 share grant 同 grantee 是否合併權限 | ✅ backend schema unique key 強制 1 grant per pair |
| 4 | PagedResp meta 層級 | ✅ (A) `{ok, data:{items}, meta}` (msg #156) |
| 5 | camelCase / snake_case 邊界 | ✅ (a) service 層手動轉換（見 §3.0） |
| 6 | `Storage::disk('drive')` 衝突 | ✅ 零衝突（既有 image disk 是 `'public'`，msg #156 verify） |
| 7 | JwtMiddleware IDOR 涵蓋 | ✅ 所有 image/tag route 在 `Route::middleware('jwt')->group()` 內，零漏掛（msg #156 verify） |

---

## 15. Implement 起跑 task 清單

### 啟動條件
1. ✅ 三方 spec 交付完
2. ✅ wiki 一致性 review 過
3. ✅ 使用者最終 GO

### 15.1 第一批 (P0, MVP)

- [x] T1: `driveService.ts` skeleton + `axios.ts` interceptor unwrap + `DriveServiceError`
- [x] T2: `errorMap.ts`（補 koatag spec 的 codes）
- [x] T3: `folderTreeStore` / `driveQuotaStore` / `uploadQueueStore`（zustand）
- [x] T4: `DrivePage` route + Sidebar entry + lazy load
- [x] T5: `Breadcrumb` + `FileGrid` + `FileList` + view toggle
- [x] T6: `FileCard` / `FolderCard`（含 mime icon 邏輯）
- [x] T7: `SortMenu` + `SearchBar`（debounce 300ms）
- [x] T8: `UploadDropzone`（react-dropzone overlay）+ 50MB guard
- [x] T9: `UploadProgressList` + `useUploadScheduler`（max 3 並行）
- [x] T10: `QuotaIndicator`（sidebar 底）
- [x] T11: `ContextMenu`（rename / move / delete）
- [x] T12: `VideoPlayer`（preload metadata）
- [x] T13: `DriveFilePage`（lightbox / video player 整合）
- [x] T14: IDOR fix — image/tag service 移除 user_id path param + service test
- [x] T15: Playwright e2e setup + S1-S7

### 15.2 第二批 (P1, v2-v3)
- [ ] Video poster frame（v2，backend v2 backlog 未動）
- [x] image_data_id 對應 UI（v2，T13 readonly tag 已 wire）
- [x] ShareDialog（v3，Phase 1 + 2B 完成）
- [x] ShareLinkDialog（v3）
- [x] /drive/shared/in 與 /drive/shared/out（v3）
- [x] /drive/share/:token landing（v3，含 v?-zip folder download）

### 15.3 第三批 (P2, v4)
- [ ] Chunked / resumable upload（tus client）
- [ ] HLS player wrapper
- [ ] FTS 搜尋 UI

---

## 16. 引用文件

- backend spec：`KOATAG/CLOUD_DRIVE_BACKEND_SPEC.md` v1.0（14 段，2026-05-09）
- 可行性評估：`koatag-frontend/CLOUD_DRIVE_FEASIBILITY.md`
- wiki reference：
  - `wiki/concepts/雲端硬碟設計/雲端硬碟設計.md` (folder-note)
  - `subtopics/HTTP-Range-Requests.md` (commit `b50904d`)
  - `subtopics/Resumable-Upload-Protocol.md` (`b50904d`)
  - `subtopics/Object-Storage-設計.md` (`b50904d`) — 含 presigned URL 段
  - `subtopics/ACL-vs-Capability權限模型.md` (`b50904d`) — 含混血策略段，drive_shares=ACL / drive_share_links=Capability
  - `subtopics/X-Accel-Redirect.md` (commit `4611e3c`) — 含 KOATAG 5 步驟流程示範

---

## 狀態歷史

- v1.0（2026-05-09）：細節 spec freeze candidate
- v1.1（2026-05-09）：對齊 backend spec patch
- v1.2（2026-05-14）：implement 階段 P0 + v? + v3 全 done；§15 task 同步勾選；標頭引用對齊 contract v1.2 + backend 實質 v1.5
