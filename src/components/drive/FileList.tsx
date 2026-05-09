import React from "react";
import { DriveFile, DriveFolder } from "services/drive.service";
import { formatBytes, getMimeIconText } from "./FileGrid";

interface FileListProps {
  folders: DriveFolder[];
  files: DriveFile[];
  onItemOpen: (item: DriveFile | DriveFolder, kind: "file" | "folder") => void;
  onItemContextMenu?: (
    item: DriveFile | DriveFolder,
    kind: "file" | "folder",
    e: React.MouseEvent,
  ) => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const FileList: React.FC<FileListProps> = ({
  folders,
  files,
  onItemOpen,
  onItemContextMenu,
}) => {
  return (
    <table className="drive-list">
      <thead>
        <tr>
          <th aria-label="icon" />
          <th>名稱</th>
          <th>大小</th>
          <th>修改時間</th>
        </tr>
      </thead>
      <tbody>
        {folders.map((folder) => (
          <tr
            key={`folder-${folder.id}`}
            onClick={() => onItemOpen(folder, "folder")}
            onContextMenu={(e) => {
              e.preventDefault();
              onItemContextMenu?.(folder, "folder", e);
            }}
          >
            <td>📁</td>
            <td>{folder.name}</td>
            <td>—</td>
            <td>{formatDate(folder.updated_at)}</td>
          </tr>
        ))}
        {files.map((file) => (
          <tr
            key={`file-${file.id}`}
            onClick={() => onItemOpen(file, "file")}
            onContextMenu={(e) => {
              e.preventDefault();
              onItemContextMenu?.(file, "file", e);
            }}
          >
            <td>{getMimeIconText(file.mime)}</td>
            <td>{file.name}</td>
            <td>{formatBytes(file.size_bytes)}</td>
            <td>{formatDate(file.updated_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
