import { create } from "zustand";
import { DriveFile, MAX_SYNC_UPLOAD_BYTES } from "services/drive.service";
import { messageForCode } from "services/drive.errorMap";

export type UploadStatus = "pending" | "uploading" | "done" | "error";

export interface UploadItem {
  id: string;
  file: File;
  folderId: number | null;
  status: UploadStatus;
  progress: number;
  errorCode?: string;
  errorMessage?: string;
  result?: DriveFile;
  enqueuedAt: number;
  // T9 useUploadScheduler 開始 upload 時 set，cancel(uploading) 時 abort
  abortController?: AbortController;
  // D.16: 2GB UX hardening
  retryCount: number;             // 重試次數（init 0；upper bound MAX_RETRIES）
  bytesSent: number;              // axios onUploadProgress 累計 loaded（throttle 寫 store）
  startedAt?: number;             // scheduler pending → uploading 時 set，retry 重設
  // R3 #7 §2.2.2/§2.2.3 — magic-byte-detected mime from the pre-encrypt gate.
  // Persisted as mime_claimed + inside the ciphertext {name, mime} payload when
  // the encrypt upload path consumes this item (scheduler cutover — see note).
  detectedMime?: string;
  // R3 #7 §2.2.2 — non-blocking advisory (POLYGLOT_WARN). Item still uploads;
  // UploadProgressList surfaces the warning text.
  warnCode?: string;
  warnMessage?: string;
}

// R3 #7 §2.2.2 — options the dropzone passes after the pre-encrypt mime check.
export interface EnqueueOpts {
  detectedMime?: string;
  /** Strict block (e.g. UNSUPPORTED_MIME) — item enters the queue as an error. */
  rejectCode?: string;
  /** Loose advisory (e.g. POLYGLOT_WARN) — item uploads but shows a warning. */
  warnCode?: string;
}

export const MAX_UPLOAD_RETRIES = 3;

interface UploadQueueState {
  queue: UploadItem[];
}

interface UploadQueueActions {
  enqueue: (file: File, folderId: number | null, opts?: EnqueueOpts) => string;
  setStatus: (id: string, status: UploadStatus) => void;
  setProgress: (id: string, progress: number) => void;
  setProgressBytes: (id: string, bytesSent: number, percent: number) => void;
  setStarted: (id: string) => void;
  setResult: (id: string, result: DriveFile) => void;
  setError: (id: string, code: string, message: string) => void;
  setAbortController: (id: string, ctrl: AbortController | undefined) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
}

function genId(): string {
  // 跨 tab safe + 1ms 內多檔不撞
  return `upl-${crypto.randomUUID()}`;
}

export const useUploadQueueStore = create<UploadQueueState & UploadQueueActions>(
  (set, get) => ({
    queue: [],

    enqueue: (file, folderId, opts) => {
      const id = genId();
      const oversize = file.size > MAX_SYNC_UPLOAD_BYTES;
      // R3 #7 §2.2.2 — a client-side reject (UNSUPPORTED_MIME) takes precedence,
      // entering the queue as an error so the user sees why it was skipped.
      // Oversize keeps its existing FILE_TOO_LARGE precedence.
      const rejectCode = oversize ? "FILE_TOO_LARGE" : opts?.rejectCode;
      const item: UploadItem = {
        id,
        file,
        folderId,
        status: rejectCode ? "error" : "pending",
        progress: 0,
        errorCode: rejectCode,
        errorMessage: rejectCode ? messageForCode(rejectCode) : undefined,
        enqueuedAt: Date.now(),
        retryCount: 0,
        bytesSent: 0,
        detectedMime: opts?.detectedMime,
        warnCode: rejectCode ? undefined : opts?.warnCode,
        warnMessage:
          !rejectCode && opts?.warnCode ? messageForCode(opts.warnCode) : undefined,
      };
      set((s) => ({ queue: [...s.queue, item] }));
      return id;
    },

    setStatus: (id, status) =>
      set((s) => ({
        queue: s.queue.map((q) => (q.id === id ? { ...q, status } : q)),
      })),

    setProgress: (id, progress) =>
      set((s) => ({
        queue: s.queue.map((q) => (q.id === id ? { ...q, progress } : q)),
      })),

    setProgressBytes: (id, bytesSent, percent) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, bytesSent, progress: percent } : q,
        ),
      })),

    setStarted: (id) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, startedAt: Date.now(), bytesSent: 0 } : q,
        ),
      })),

    setResult: (id, result) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, status: "done", progress: 100, result } : q
        ),
      })),

    setError: (id, code, message) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, status: "error", errorCode: code, errorMessage: message } : q
        ),
      })),

    setAbortController: (id, ctrl) =>
      set((s) => ({
        queue: s.queue.map((q) => (q.id === id ? { ...q, abortController: ctrl } : q)),
      })),

    cancel: (id) => {
      const item = get().queue.find((q) => q.id === id);
      if (!item) return;
      // uploading 中：abort axios + set status='error'
      if (item.status === "uploading" && item.abortController) {
        item.abortController.abort();
      }
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id && (q.status === "pending" || q.status === "uploading")
            ? {
                ...q,
                status: "error",
                errorCode: "CANCELLED",
                errorMessage: "已取消",
                abortController: undefined,
              }
            : q
        ),
      }));
    },

    retry: (id) =>
      set((s) => ({
        queue: s.queue.map((q) => {
          if (
            q.id !== id ||
            q.status !== "error" ||
            q.errorCode === "FILE_TOO_LARGE"
          ) {
            return q;
          }
          // D.16: max 3 retry — 超過上限轉永久 error，提示 user 手動重選
          if (q.retryCount >= MAX_UPLOAD_RETRIES) {
            return {
              ...q,
              errorMessage: `重試 ${MAX_UPLOAD_RETRIES} 次仍失敗，請手動重新選擇檔案`,
            };
          }
          return {
            ...q,
            status: "pending",
            progress: 0,
            bytesSent: 0,
            startedAt: undefined,
            errorCode: undefined,
            errorMessage: undefined,
            abortController: undefined,
            retryCount: q.retryCount + 1,
          };
        }),
      })),

    remove: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),

    clearDone: () => set((s) => ({ queue: s.queue.filter((q) => q.status !== "done") })),

    clearAll: () => set({ queue: [] }),
  })
);
