import { create } from "zustand";
import type { IncomingShare } from "../services/drive.service";
import {
  unwrapIncomingShare,
  type IncomingSharePayload,
  type IncomingShareUnwrapped,
} from "../services/drive.shareGrant";

// R3 #5 §1.8 — in-memory cache of incoming shares + unwrapped file/thumb
// keys. Never persisted (no IDB, no localStorage) — XSS attack surface
// minimization. Cleared on logout (6-layer chain in auth.service.tsx).
//
// Unwrap path uses parallel cap 2 (matches R3 #4 §3.15 decrypt sem) so that
// large incoming-share inboxes don't block the main thread.

export type UnwrapStatus = "idle" | "loading" | "ready" | "error";

interface SharedWithMeState {
  shares: IncomingShare[];
  // resource_id → unwrapped cleartext keys (cleared on logout).
  unwrappedFileKeys: Map<number, Uint8Array>;
  unwrappedThumbKeys: Map<number, Uint8Array>;
  status: UnwrapStatus;
  errorMessage?: string;
}

interface SharedWithMeActions {
  setShares: (shares: IncomingShare[]) => void;
  unwrapAll: (payloads: IncomingSharePayload[]) => Promise<void>;
  invalidate: (resourceId: number) => void;
  clear: () => void;
}

// Tiny semaphore — copy of decryptClient pattern to keep store self-contained.
class Semaphore {
  private available: number;
  private queue: Array<() => void> = [];
  constructor(capacity: number) {
    this.available = capacity;
  }
  async acquire(): Promise<void> {
    if (this.available > 0) {
      this.available--;
      return;
    }
    await new Promise<void>((resolve) => {
      this.queue.push(() => {
        this.available--;
        resolve();
      });
    });
  }
  release(): void {
    this.available++;
    const next = this.queue.shift();
    if (next) next();
  }
}

const SHARE_UNWRAP_CONCURRENCY = 2;

export const useSharedWithMeStore = create<SharedWithMeState & SharedWithMeActions>(
  (set, get) => ({
    shares: [],
    unwrappedFileKeys: new Map(),
    unwrappedThumbKeys: new Map(),
    status: "idle",
    errorMessage: undefined,

    setShares: (shares) => set({ shares }),

    unwrapAll: async (payloads) => {
      set({ status: "loading", errorMessage: undefined });
      const sem = new Semaphore(SHARE_UNWRAP_CONCURRENCY);
      const fileKeys = new Map<number, Uint8Array>();
      const thumbKeys = new Map<number, Uint8Array>();
      try {
        await Promise.all(
          payloads.map(async (p) => {
            await sem.acquire();
            try {
              const unwrapped: IncomingShareUnwrapped = await unwrapIncomingShare(p);
              fileKeys.set(unwrapped.resource_id, unwrapped.fileKey);
              if (unwrapped.thumbKey) {
                thumbKeys.set(unwrapped.resource_id, unwrapped.thumbKey);
              }
            } finally {
              sem.release();
            }
          }),
        );
        set({
          unwrappedFileKeys: fileKeys,
          unwrappedThumbKeys: thumbKeys,
          status: "ready",
        });
      } catch (err: any) {
        set({
          status: "error",
          errorMessage: err?.message ?? "解封 incoming shares 失敗",
        });
      }
    },

    invalidate: (resourceId) => {
      const fileKeys = new Map(get().unwrappedFileKeys);
      const thumbKeys = new Map(get().unwrappedThumbKeys);
      fileKeys.delete(resourceId);
      thumbKeys.delete(resourceId);
      set({ unwrappedFileKeys: fileKeys, unwrappedThumbKeys: thumbKeys });
    },

    clear: () => {
      // R3 #5 §1.8 — 6th layer of logout chain.
      set({
        shares: [],
        unwrappedFileKeys: new Map(),
        unwrappedThumbKeys: new Map(),
        status: "idle",
        errorMessage: undefined,
      });
    },
  }),
);
