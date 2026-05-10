import React from "react";
import { useDriveStreamUrl } from "hooks/useDriveStreamUrl";

interface VideoPlayerProps {
  fileId: number;
  name: string;
}

/**
 * Drive video 播放（spec §2.12 / §6）。
 *
 * - 用 `useDriveStreamUrl(fileId, 'stream')` 拿 signed URL（POST /stream-url 取 sig+exp）
 * - `<video preload="metadata">`：只下 header，user 按 play 才實 stream
 * - 瀏覽器 native Range request 直接打 backend，dev `BinaryFileResponse` /
 *   prod `X-Accel-Redirect` 走 nginx；frontend 行為一致
 * - 觀察「拖時間軸 → multiple 206 Partial Content」走 spec §13.2 S6 e2e
 *
 * v2 才加 poster `poster={posterUrl(id)}`（backend poster endpoint 還沒）。
 */
export const VideoPlayer: React.FC<VideoPlayerProps> = ({ fileId, name }) => {
  const { url, loading, error } = useDriveStreamUrl(fileId, "stream");

  if (loading) {
    return <div className="drive-video-loading">載入中…</div>;
  }
  if (error) {
    return <div className="drive-video-error">{error}</div>;
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
    >
      您的瀏覽器不支援 video 標籤
    </video>
  );
};
