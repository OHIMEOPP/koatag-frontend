import { create } from "zustand";
import driveApi, { unwrapDriveBody } from "api/driveAxios";

// R3 #5 §1.7 + R3 #6 §1.6 §3.9 LOCKED — 30s polling for incoming-share
// unread count + cascade-revoke detection.
//
// Sidebar Drive section badge displays `count` when > 0. SharedWithMePage
// mount-time calls markAllRead() to zero the badge.
//
// R3 #6 extension: polling response also returns `removed_share_ids` — IDs
// that were cascade-revoked since `lastChecked` (caused by owner trashing /
// permanently deleting the shared resource). Store stages them for the
// SharedWithMePage UI hook to drain + cascade invalidate
// (sharedWithMeStore.unwrappedFileKeys + decryptedAssetStore).
//
// Polling started by app shell (e.g. DrivePage mount).

interface UnreadResponse {
  count: number;
  // R3 #6 §3.9 LOCKED — share IDs cascade-revoked since last poll.
  removed_share_ids?: number[];
}

interface IncomingShareNotifyState {
  count: number;
  lastChecked: number; // ms epoch — sent to backend as `since`
  polling: boolean;
  // Pending cascade-revoke IDs — UI consumer (SharedWithMePage useEffect)
  // drains via `consumeRemoved` and triggers store invalidations.
  pendingRemoved: number[];
}

interface IncomingShareNotifyActions {
  startPolling: () => void;
  stopPolling: () => void;
  pollOnce: () => Promise<void>;
  markAllRead: () => Promise<void>;
  /**
   * R3 #6 §1.6 — UI hook drains pending cascade-revoke IDs. Returns the
   * array of removed_share_ids and clears the pending buffer atomically.
   * Caller cascades invalidation: sharedWithMeStore.invalidate per id +
   * decryptedAssetStore.delete per resource_id.
   */
  consumeRemoved: () => number[];
  reset: () => void;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;
const POLL_INTERVAL_MS = 30_000;

async function fetchUnread(since: number): Promise<UnreadResponse> {
  const resp: any = await driveApi.get("/drive/shares/incoming/unread", {
    params: { since: Math.floor(since / 1000) },
  });
  const { data } = unwrapDriveBody<UnreadResponse>(resp.data);
  return data;
}

async function postMarkRead(): Promise<void> {
  await driveApi.post("/drive/shares/incoming/mark-read");
}

export const useIncomingShareNotifyStore = create<
  IncomingShareNotifyState & IncomingShareNotifyActions
>((set, get) => ({
  count: 0,
  lastChecked: 0,
  polling: false,
  pendingRemoved: [],

  startPolling: () => {
    if (get().polling) return;
    set({ polling: true });
    get().pollOnce().catch(() => {/* swallow */});
    pollTimer = setInterval(() => {
      get().pollOnce().catch(() => {/* swallow */});
    }, POLL_INTERVAL_MS);
  },

  stopPolling: () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    set({ polling: false });
  },

  pollOnce: async () => {
    try {
      const resp = await fetchUnread(get().lastChecked);
      // Append new removed IDs to pendingRemoved (dedup against existing).
      const incoming = resp.removed_share_ids ?? [];
      let nextPending = get().pendingRemoved;
      if (incoming.length > 0) {
        const seen = new Set(nextPending);
        const additions = incoming.filter((id) => !seen.has(id));
        if (additions.length > 0) {
          nextPending = [...nextPending, ...additions];
        }
      }
      set({
        count: resp.count,
        lastChecked: Date.now(),
        pendingRemoved: nextPending,
      });
    } catch {
      // Non-fatal — keep previous count, retry on next tick.
    }
  },

  markAllRead: async () => {
    try {
      await postMarkRead();
      set({ count: 0, lastChecked: Date.now() });
    } catch {
      // Non-fatal — don't reset count if backend errored.
    }
  },

  consumeRemoved: () => {
    const ids = get().pendingRemoved;
    if (ids.length === 0) return ids;
    set({ pendingRemoved: [] });
    return ids;
  },

  reset: () => {
    get().stopPolling();
    set({ count: 0, lastChecked: 0, polling: false, pendingRemoved: [] });
  },
}));
