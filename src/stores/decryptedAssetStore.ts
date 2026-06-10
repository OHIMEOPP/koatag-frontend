// R3 #4 §1.8 — decryptedAssetStore LRU cache for decrypted thumbnails + full
// images. Keeps decrypted ObjectURLs alive across re-renders to avoid
// re-decrypt churn on list scroll / image flip.
//
// Schema:
//   - cacheKey = `${fileId}:${kind}` (kind: 'thumb' | 'full' — video chunks
//     are managed by MSE source buffer internally, not cached here)
//   - LRU eviction: 50 items OR 100MB memory budget (whichever first)
//   - Mobile auto-cap per §3.18 LOCKED: navigator.deviceMemory < 4 → 25/50MB
//   - Eviction → URL.revokeObjectURL to release Blob reference
//   - logout fifth-layer (per R2 #1 §2.2.11 + R3 #4 dispatch §1.8) → clear()
//     purges all ObjectURLs (covers Worker terminate, master_key zero-out,
//     localStorage clear, fetch in-flight abort, ObjectURL purge)

export type AssetKind = "thumb" | "full";

interface AssetEntry {
  url: string;        // object URL handed out to consumers
  size: number;       // bytes (used for memory-budget eviction)
  lastUsed: number;   // ms epoch (for LRU)
}

interface DecryptedAssetStore {
  get(fileId: number, kind: AssetKind): string | undefined;
  put(fileId: number, kind: AssetKind, blob: Blob): string;
  delete(fileId: number, kind?: AssetKind): void;
  clear(): void;
  // Diagnostic — expose internals to allow tests + dev UI to inspect.
  _peek(): { entries: number; bytes: number; capItems: number; capBytes: number };
}

function isMobileLowMem(): boolean {
  // Chrome / Edge expose navigator.deviceMemory (GB rounded). Safari /
  // Firefox don't — treat undefined as desktop default.
  const dm = (navigator as { deviceMemory?: number }).deviceMemory;
  return typeof dm === "number" && dm < 4;
}

function createStore(): DecryptedAssetStore {
  const desktop = { items: 50, bytes: 100 * 1024 * 1024 };
  const mobile = { items: 25, bytes: 50 * 1024 * 1024 };
  const cap = isMobileLowMem() ? mobile : desktop;

  const map = new Map<string, AssetEntry>();
  let totalBytes = 0;

  function keyOf(fileId: number, kind: AssetKind): string {
    return `${fileId}:${kind}`;
  }

  function revoke(key: string): void {
    const entry = map.get(key);
    if (!entry) return;
    try {
      URL.revokeObjectURL(entry.url);
    } catch {
      // ignore — URL may already be invalid
    }
    totalBytes -= entry.size;
    map.delete(key);
  }

  function evictUntilFits(incomingBytes: number): void {
    while (
      map.size + 1 > cap.items ||
      totalBytes + incomingBytes > cap.bytes
    ) {
      if (map.size === 0) break;
      // Find LRU entry (lowest lastUsed).
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      map.forEach((entry, key) => {
        if (entry.lastUsed < oldestTime) {
          oldestTime = entry.lastUsed;
          oldestKey = key;
        }
      });
      if (!oldestKey) break;
      revoke(oldestKey);
    }
  }

  return {
    get(fileId, kind) {
      const key = keyOf(fileId, kind);
      const entry = map.get(key);
      if (!entry) return undefined;
      entry.lastUsed = Date.now();
      return entry.url;
    },

    put(fileId, kind, blob) {
      const key = keyOf(fileId, kind);
      // Overwrite — revoke any existing entry for the same key first.
      if (map.has(key)) {
        revoke(key);
      }
      evictUntilFits(blob.size);
      const url = URL.createObjectURL(blob);
      map.set(key, { url, size: blob.size, lastUsed: Date.now() });
      totalBytes += blob.size;
      return url;
    },

    delete(fileId, kind) {
      if (kind) {
        revoke(keyOf(fileId, kind));
      } else {
        // Delete both thumb + full for this fileId.
        revoke(keyOf(fileId, "thumb"));
        revoke(keyOf(fileId, "full"));
      }
    },

    clear() {
      // R3 #4 §1.8 5th-layer logout purge — revoke all object URLs.
      const keys = Array.from(map.keys());
      keys.forEach(revoke);
    },

    _peek() {
      return {
        entries: map.size,
        bytes: totalBytes,
        capItems: cap.items,
        capBytes: cap.bytes,
      };
    },
  };
}

export const decryptedAssetStore: DecryptedAssetStore = createStore();
