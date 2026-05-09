import { create } from "zustand";
import { DriveFile, MAX_SYNC_UPLOAD_BYTES } from "services/drive.service";

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
}

interface UploadQueueState {
  queue: UploadItem[];
}

interface UploadQueueActions {
  enqueue: (file: File, folderId: number | null) => string;
  setStatus: (id: string, status: UploadStatus) => void;
  setProgress: (id: string, progress: number) => void;
  setResult: (id: string, result: DriveFile) => void;
  setError: (id: string, code: string, message: string) => void;
  cancel: (id: string) => void;
  retry: (id: string) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
}

let nextId = 0;
function genId(): string {
  nextId += 1;
  return `upl-${Date.now()}-${nextId}`;
}

export const useUploadQueueStore = create<UploadQueueState & UploadQueueActions>(
  (set) => ({
    queue: [],

    enqueue: (file, folderId) => {
      const id = genId();
      const oversize = file.size > MAX_SYNC_UPLOAD_BYTES;
      const item: UploadItem = {
        id,
        file,
        folderId,
        status: oversize ? "error" : "pending",
        progress: 0,
        errorCode: oversize ? "FILE_TOO_LARGE" : undefined,
        errorMessage: oversize ? "檔案超過 50MB 限制" : undefined,
        enqueuedAt: Date.now(),
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

    cancel: (id) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id && q.status === "pending"
            ? { ...q, status: "error", errorCode: "CANCELLED", errorMessage: "已取消" }
            : q
        ),
      })),

    retry: (id) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id && q.status === "error" && q.errorCode !== "FILE_TOO_LARGE"
            ? { ...q, status: "pending", progress: 0, errorCode: undefined, errorMessage: undefined }
            : q
        ),
      })),

    remove: (id) => set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),

    clearDone: () => set((s) => ({ queue: s.queue.filter((q) => q.status !== "done") })),

    clearAll: () => set({ queue: [] }),
  })
);
