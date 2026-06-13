import { useCallback, useEffect, useState } from "react";
import {
  DriveFile,
  streamUrl,
  thumbUrl,
  invalidateSigCache,
} from "services/drive.service";
import { downloadEncryptedFile } from "services/drive.download";
import { mapDriveError } from "services/drive.errorMap";
import { decryptedAssetStore, AssetKind } from "stores/decryptedAssetStore";

export type DisplayAssetKind = "thumb" | "stream";

interface UseDecryptedAssetUrlResult {
  url: string | undefined;
  loading: boolean;
  error: string | null;
  /** 強制重簽（明文 sig 過期 race）/ 重新解密（加密檔）。 */
  refresh: () => void;
}

/**
 * R2 #4 enforce 後續 — inline 顯示（縮圖 / 預覽 / 全螢幕 / 影片）統一入口。
 *
 * 背景：`DRIVE_ENFORCE_ENCRYPTED_UPLOAD=true` 上線後所有新上傳一律加密。
 * 加密檔沒有伺服器縮圖、`/drive/files/{id}/download|thumb` 對密文吐密文或 409，
 * 直接餵 `<img>/<video>` 會空白。此 hook 對 `is_encrypted` 檔改走
 * 「fetch 密文 → 解密 → object URL」，明文檔沿用既有 signed-URL 路徑。
 *
 * - 明文：`thumbUrl(id)` / `streamUrl(id)` signed URL（同 useDriveStreamUrl）
 * - 加密：`downloadEncryptedFile(file)` 拿明文 Blob → `decryptedAssetStore`
 *   LRU cache → object URL。加密檔無伺服器縮圖，thumb 與 full 解的是同一份明文，
 *   故統一 cache 在單一 `full` key，避免清單縮圖跟詳情頁重複解密同檔。
 *
 * 影片加密檔走「整檔解密 → blob object URL → `<video src>`」(本地播放 degrade)；
 * MSE 逐段 streaming 解密留 polish round。
 */
export function useDecryptedAssetUrl(
  file: DriveFile | null | undefined,
  kind: DisplayAssetKind,
): UseDecryptedAssetUrlResult {
  const [url, setUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fileId = file?.id ?? null;
  const isEncrypted = !!file?.is_encrypted;

  const refresh = useCallback(() => {
    if (fileId != null) {
      invalidateSigCache(fileId);
      // 加密檔強制重新解密：清掉 cache 該檔兩種 kind。
      decryptedAssetStore.delete(fileId);
    }
    setRefreshKey((k) => k + 1);
  }, [fileId]);

  useEffect(() => {
    if (!file || fileId == null) {
      setUrl(undefined);
      setError(null);
      setLoading(false);
      return;
    }

    let aborted = false;

    // ── 明文 grandfather 檔：既有 signed-URL 路徑 ──
    if (!isEncrypted) {
      setLoading(true);
      setError(null);
      const fetcher = kind === "thumb" ? thumbUrl : streamUrl;
      fetcher(fileId)
        .then((u) => {
          if (!aborted) {
            setUrl(u);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!aborted) {
            setError(mapDriveError(e));
            setLoading(false);
          }
        });
      return () => {
        aborted = true;
      };
    }

    // ── 加密檔：fetch 密文 → 解密 → object URL（cache 命中直接回）──
    const storeKind: AssetKind = "full";
    const cached = decryptedAssetStore.get(fileId, storeKind);
    if (cached) {
      setUrl(cached);
      setLoading(false);
      setError(null);
      return () => {
        aborted = true;
      };
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    downloadEncryptedFile(file, { signal: ac.signal })
      .then((blob) => {
        if (aborted) return;
        const objectUrl = decryptedAssetStore.put(fileId, storeKind, blob);
        setUrl(objectUrl);
        setLoading(false);
      })
      .catch((e) => {
        if (aborted) return;
        if (e?.code === "DOWNLOAD_ABORTED") return;
        setError(mapDriveError(e));
        setLoading(false);
      });
    return () => {
      aborted = true;
      ac.abort();
    };
    // file 物件 identity 變動時重跑；加密路徑有 cache 短路，不會重複解密。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId, isEncrypted, kind, refreshKey, file?.key_wrap]);

  return { url, loading, error, refresh };
}
