import React from "react";
import { DriveFolder } from "services/drive.service";

interface FolderCardProps {
  folder: DriveFolder;
  onOpen: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export const FolderCard: React.FC<FolderCardProps> = ({ folder, onOpen, onContextMenu }) => {
  return (
    <div
      className="drive-card drive-card-folder"
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu?.(e);
      }}
    >
      <div className="drive-card-icon">📁</div>
      <div className="drive-card-name" title={folder.name}>
        {folder.name}
      </div>
    </div>
  );
};
