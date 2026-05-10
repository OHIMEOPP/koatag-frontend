import React, { useState } from "react";
import { DriveFile } from "services/drive.service";
import { useDriveStreamUrl } from "hooks/useDriveStreamUrl";
import { formatBytes, getMimeIconText } from "./FileGrid";

interface FileCardProps {
  file: DriveFile;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const FileCard: React.FC<FileCardProps> = ({ file, onOpen, onContextMenu }) => {
  const isImage = file.mime.startsWith("image/");
  const hasThumb = isImage && !!file.thumb_path;
  const { url: thumbUrl, error } = useDriveStreamUrl(hasThumb ? file.id : null, "thumb");
  const [imgError, setImgError] = useState(false);
  const showThumb = hasThumb && thumbUrl && !error && !imgError;

  return (
    <div
      className="drive-card drive-card-file"
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
    >
      <div className={`drive-card-icon ${showThumb ? "drive-card-icon-thumb" : ""}`}>
        {showThumb ? (
          <img
            className="drive-card-thumb"
            src={thumbUrl}
            alt={file.name}
            loading="lazy"
            onError={() => setImgError(true)}
          />
        ) : (
          getMimeIconText(file.mime)
        )}
      </div>
      <div className="drive-card-name" title={file.name}>
        {file.name}
      </div>
      <div className="drive-card-meta">{formatBytes(file.size_bytes)}</div>
    </div>
  );
};
