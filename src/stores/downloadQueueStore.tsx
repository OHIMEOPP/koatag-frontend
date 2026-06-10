import { create } from "zustand";
import type { DriveFile } from "services/drive.service";

// R3 #4 §1.3 — download queue store (mirror uploadQueueStore pattern, R3 #1
// scope). DownloadProgressList UI component + DrivePage wire deferred to R3
// housekeeping per R3 #1/#2/#3 UI integration defer precedent (per wiki
// #1666 §1 scope plan ack).

export type DownloadStatus = "pending" | "downloading" | "done" | "error";

// 4-layer failure differentiation (per R3 #4 §3.8 LOCKED).
export type DownloadErrorCode =
  | "KEYS_MISSING"
  | "WRAP_DECRYPT"
  | "MANIFEST_FAIL"
  | "FETCH_FAIL"
  | "CHUNK_HASH"
  | "CHUNK_DECRYPT"
  | "DOWNLOAD_ABORTED"
  | "OTHER";

export interface DownloadItem {
  id: string;
  file: DriveFile;
  status: DownloadStatus;
  bytesDecrypted: number;
  totalBytes: number;
  completedChunks: number;
  totalChunks: number;
  enqueuedAt: number;
  startedAt?: number;
  abortController?: AbortController;
  errorCode?: DownloadErrorCode;
  errorMessage?: string;
  resultBlob?: Blob;
}

interface DownloadQueueState {
  queue: DownloadItem[];
}

interface DownloadQueueActions {
  enqueue: (file: DriveFile) => string;
  setStatus: (id: string, status: DownloadStatus) => void;
  setStarted: (id: string, totalBytes: number, totalChunks: number) => void;
  setProgress: (id: string, bytesDecrypted: number, completedChunks: number) => void;
  setResult: (id: string, blob: Blob) => void;
  setError: (id: string, code: DownloadErrorCode, message: string) => void;
  setAbortController: (id: string, ctrl: AbortController | undefined) => void;
  cancel: (id: string) => void;
  remove: (id: string) => void;
  clearDone: () => void;
  clearAll: () => void;
}

function genId(): string {
  return `dl-${crypto.randomUUID()}`;
}

export const useDownloadQueueStore = create<DownloadQueueState & DownloadQueueActions>(
  (set, get) => ({
    queue: [],

    enqueue: (file) => {
      const id = genId();
      const item: DownloadItem = {
        id,
        file,
        status: "pending",
        bytesDecrypted: 0,
        totalBytes: file.size_bytes,
        completedChunks: 0,
        totalChunks: 0,
        enqueuedAt: Date.now(),
      };
      set((s) => ({ queue: [...s.queue, item] }));
      return id;
    },

    setStatus: (id, status) =>
      set((s) => ({
        queue: s.queue.map((q) => (q.id === id ? { ...q, status } : q)),
      })),

    setStarted: (id, totalBytes, totalChunks) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id
            ? { ...q, startedAt: Date.now(), status: "downloading", totalBytes, totalChunks }
            : q,
        ),
      })),

    setProgress: (id, bytesDecrypted, completedChunks) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, bytesDecrypted, completedChunks } : q,
        ),
      })),

    setResult: (id, resultBlob) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, status: "done", resultBlob } : q,
        ),
      })),

    setError: (id, errorCode, errorMessage) =>
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id ? { ...q, status: "error", errorCode, errorMessage } : q,
        ),
      })),

    setAbortController: (id, abortController) =>
      set((s) => ({
        queue: s.queue.map((q) => (q.id === id ? { ...q, abortController } : q)),
      })),

    cancel: (id) => {
      const item = get().queue.find((q) => q.id === id);
      item?.abortController?.abort();
      set((s) => ({
        queue: s.queue.map((q) =>
          q.id === id
            ? { ...q, status: "error", errorCode: "DOWNLOAD_ABORTED", errorMessage: "下載已取消" }
            : q,
        ),
      }));
    },

    remove: (id) =>
      set((s) => ({ queue: s.queue.filter((q) => q.id !== id) })),

    clearDone: () =>
      set((s) => ({ queue: s.queue.filter((q) => q.status !== "done") })),

    clearAll: () => set({ queue: [] }),
  }),
);
