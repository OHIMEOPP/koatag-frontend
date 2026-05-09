import { useEffect, useState } from "react";
import { streamUrl, downloadUrl, thumbUrl } from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";

export type StreamUrlMode = "stream" | "download" | "thumb";

interface UseDriveStreamUrlResult {
  url: string | undefined;
  loading: boolean;
  error: string | null;
}

/**
 * 取 drive file 的 signed URL（對應 backend B17 / spec §16）。
 *
 * - mode 'stream'   → `<video src>` / `<img src>` inline 顯示
 * - mode 'download' → `<a href>` 下載觸發 attachment
 * - mode 'thumb'    → `<img src>` 縮圖
 *
 * URL 5 分鐘過期（依 backend `DRIVE_SIGNED_URL_EXPIRES`），
 * fileId 變化時重新 sign。Component unmount 自動 abort。
 */
export function useDriveStreamUrl(
  fileId: number | null | undefined,
  mode: StreamUrlMode = "stream"
): UseDriveStreamUrlResult {
  const [url, setUrl] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (fileId == null) {
      setUrl(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    let aborted = false;
    setLoading(true);
    setError(null);
    const fetcher =
      mode === "download" ? downloadUrl : mode === "thumb" ? thumbUrl : streamUrl;
    fetcher(fileId)
      .then((u) => {
        if (!aborted) {
          setUrl(u);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!aborted) {
          setError(mapDriveError(err));
          setLoading(false);
        }
      });
    return () => {
      aborted = true;
    };
  }, [fileId, mode]);

  return { url, loading, error };
}
