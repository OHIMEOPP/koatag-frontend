import { create } from "zustand";
import { listIncomingShares } from "services/drive.service";

type Permission = "read" | "write";
type Key = string; // `${resource_type}-${resource_id}`

interface BorrowedSharesState {
  /** key `${kind}-${id}` → 'read' | 'write'。不在 map 的 = 自己擁有 / 不是 borrowed */
  map: Map<Key, Permission>;
  loaded: boolean;
  loading: boolean;
  error: string | null;
  fetch: () => Promise<void>;
  reset: () => void;
}

/**
 * Phase 2 part C — borrowed permission lookup（wiki #403 Option B 短期方案）。
 *
 * mount-time 一次 `listIncomingShares()` 拿 user 收的 shares，建 map：
 * `${resource_type}-${resource_id}` → permission。
 *
 * ContextMenu / DriveFilePage 用 `keyOf(kind, id)` O(1) lookup
 * 決定 read-only / write / 自己 owner-only 不同 UI 行為。
 *
 * 升級路徑（long-term Option A）：backend list response 加
 * `borrowed_permission` field，frontend 拿掉此 store 改 `item.borrowed_permission`
 * 直接讀。migrate cost trivial。
 *
 * invalidate：mount-time fetch + 不做實時同步（user 重整頁面看到別人對你
 * 加/改/revoke share）— MVP 足夠。
 */
export const useBorrowedSharesStore = create<BorrowedSharesState>((set) => {
  const fetch = async () => {
    set({ loading: true, error: null });
    try {
      const items = await listIncomingShares();
      const map = new Map<Key, Permission>();
      for (const s of items) {
        map.set(`${s.resource_type}-${s.resource.id}`, s.permission);
      }
      set({ map, loaded: true, loading: false });
    } catch (err: any) {
      set({
        loaded: false,
        loading: false,
        error: err?.message ?? "borrowed shares load failed",
      });
    }
  };

  return {
    map: new Map(),
    loaded: false,
    loading: false,
    error: null,
    fetch,
    reset: () =>
      set({ map: new Map(), loaded: false, loading: false, error: null }),
  };
});

export function borrowedKey(
  kind: "file" | "folder",
  id: number,
): Key {
  return `${kind}-${id}`;
}
