import React, { useRef, useState } from "react";
import { DriveFile } from "services/drive.service";
import { useDecryptedAssetUrl } from "hooks/useDecryptedAssetUrl";

interface VideoPlayerProps {
  file: DriveFile;
  name: string;
}

const MAX_AUTO_REFRESH = 1;

/**
 * Drive video 播放（spec §2.12 / §6 + v3 onError refresh）。
 *
 * - 用 `useDecryptedAssetUrl(file, 'stream')` 取 src：明文檔走 signed URL
 *   （POST /stream-url 取 sig+exp）；加密檔走整檔解密→blob object URL（本地播放 degrade）
 * - `<video preload="metadata">`：只下 header，user 按 play 才實 stream
 * - 瀏覽器 native Range request 直接打 backend，dev `BinaryFileResponse` /
 *   prod `X-Accel-Redirect` 走 nginx；frontend 行為一致
 * - 觀察「拖時間軸 → multiple 206 Partial Content」走 spec §13.2 S6 e2e
 *
 * **v3 sig 5min 過期 race**：user 看 4:30 暫停、5:30 resume → backend Range
 * verify_fail → `<video onError>` fire → refresh() 清 sig cache + 重簽 →
 * url 變動瀏覽器自動重新 fetch。
 *
 * 限制 retry-once（MAX_AUTO_REFRESH）避免 codec error / network drop 無限 loop。
 *
 * v2 才加 poster `poster={posterUrl(id)}`（backend poster endpoint 還沒）。
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ file, name }) => {
  // 加密檔走整檔解密 → blob object URL（本地播放 degrade）；明文檔沿用 signed URL。
  const { url, loading, error, refresh } = useDecryptedAssetUrl(file, "stream");
  const refreshCountRef = useRef(0);
  const [persistentError, setPersistentError] = useState<string | null>(null);

  // file 換時 reset refresh count（不同 video 各自 1 次重試額度）
  React.useEffect(() => {
    refreshCountRef.current = 0;
    setPersistentError(null);
  }, [file.id]);

  const handleVideoError = () => {
    if (refreshCountRef.current < MAX_AUTO_REFRESH) {
      refreshCountRef.current += 1;
      refresh();
    } else {
      setPersistentError("影片載入失敗，請手動重整或檢查網路");
    }
  };

  if (loading) {
    return <div className="drive-video-loading">載入中…</div>;
  }
  if (error || persistentError) {
    return <div className="drive-video-error">{persistentError ?? error}</div>;
  }
  if (!url) {
    return null;
  }

  return (
    <video
      className="drive-video"
      controls
      preload="metadata"
      src={url}
      aria-label={name}
      onError={handleVideoError}
    >
      您的瀏覽器不支援 video 標籤
    </video>
  );
};
