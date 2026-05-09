import React from "react";
import { DriveFile, DriveFolder } from "services/drive.service";

interface FileGridProps {
  folders: DriveFolder[];
  files: DriveFile[];
  onItemOpen: (item: DriveFile | DriveFolder, kind: "file" | "folder") => void;
  onItemContextMenu?: (
    item: DriveFile | DriveFolder,
    kind: "file" | "folder",
    e: React.MouseEvent,
  ) => void;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function getMimeIconText(mime: string): string {
  if (mime.startsWith("image/")) return "🖼";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  if (mime === "application/pdf") return "📄";
  if (mime.startsWith("text/")) return "📝";
  return "📦";
}

export const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  onItemOpen,
  onItemContextMenu,
}) => {
  return (
    <div className="drive-grid">
      {folders.map((folder) => (
        <div
          key={`folder-${folder.id}`}
          className="drive-card drive-card-folder"
          onClick={() => onItemOpen(folder, "folder")}
          onContextMenu={(e) => {
            e.preventDefault();
            onItemContextMenu?.(folder, "folder", e);
          }}
        >
          <div className="drive-card-icon">📁</div>
          <div className="drive-card-name" title={folder.name}>
            {folder.name}
          </div>
        </div>
      ))}
      {files.map((file) => (
        <div
          key={`file-${file.id}`}
          className="drive-card drive-card-file"
          onClick={() => onItemOpen(file, "file")}
          onContextMenu={(e) => {
            e.preventDefault();
            onItemContextMenu?.(file, "file", e);
          }}
        >
          <div className="drive-card-icon">{getMimeIconText(file.mime)}</div>
          <div className="drive-card-name" title={file.name}>
            {file.name}
          </div>
          <div className="drive-card-meta">{formatBytes(file.size_bytes)}</div>
        </div>
      ))}
    </div>
  );
};
