import React from "react";
import { DriveFile, DriveFolder } from "services/drive.service";
import { FileCard } from "./FileCard";
import { FolderCard } from "./FolderCard";

interface FileGridProps {
  folders: DriveFolder[];
  files: DriveFile[];
  onItemOpen: (item: DriveFile | DriveFolder, kind: "file" | "folder") => void;
  onItemContextMenu?: (
    item: DriveFile | DriveFolder,
    kind: "file" | "folder",
    e: React.MouseEvent,
  ) => void;
  // D.14b: 空白處（cards 之間的 gap）右鍵 — 只當 target === currentTarget 時 fire
  onEmptyContextMenu?: (e: React.MouseEvent) => void;
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
  onEmptyContextMenu,
}) => {
  return (
    <div
      className="drive-grid"
      onContextMenu={(e) => {
        // 只有真在 grid 容器本身的 gap 上右鍵（target 不是 card）才 fire
        if (e.target === e.currentTarget && onEmptyContextMenu) {
          e.preventDefault();
          onEmptyContextMenu(e);
        }
      }}
    >
      {folders.map((folder) => (
        <FolderCard
          key={`folder-${folder.id}`}
          folder={folder}
          onOpen={() => onItemOpen(folder, "folder")}
          onContextMenu={(e) => onItemContextMenu?.(folder, "folder", e)}
        />
      ))}
      {files.map((file) => (
        <FileCard
          key={`file-${file.id}`}
          file={file}
          onOpen={() => onItemOpen(file, "file")}
          onContextMenu={(e) => onItemContextMenu?.(file, "file", e)}
        />
      ))}
    </div>
  );
};
