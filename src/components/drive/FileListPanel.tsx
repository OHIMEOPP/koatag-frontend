import React, { useState } from "react";
import { DriveFile, DriveFolder } from "services/drive.service";
import { Icon } from "components/Icon";
import { FileGrid } from "./FileGrid";
import { FileList } from "./FileList";

type ViewMode = "grid" | "list";

interface FileListPanelProps {
  folders: DriveFolder[];
  files: DriveFile[];
  onItemOpen: (item: DriveFile | DriveFolder, kind: "file" | "folder") => void;
  onItemContextMenu?: (
    item: DriveFile | DriveFolder,
    kind: "file" | "folder",
    e: React.MouseEvent,
  ) => void;
}

export const FileListPanel: React.FC<FileListPanelProps> = (props) => {
  // view mode 是 user 個人偏好，local state（wiki Q4 建議）
  const [view, setView] = useState<ViewMode>("grid");

  const empty = props.folders.length === 0 && props.files.length === 0;

  return (
    <div className="drive-panel">
      <div className="drive-panel-toolbar">
        <div className="drive-view-toggle">
          <button
            type="button"
            className={`drive-view-btn ${view === "grid" ? "active" : ""}`}
            onClick={() => setView("grid")}
            aria-label="Grid view"
          >
            <Icon.gallery size={16} />
          </button>
          <button
            type="button"
            className={`drive-view-btn ${view === "list" ? "active" : ""}`}
            onClick={() => setView("list")}
            aria-label="List view"
          >
            <Icon.list size={16} />
          </button>
        </div>
      </div>
      {empty ? (
        <div className="drive-empty">這個資料夾沒有任何檔案或資料夾</div>
      ) : view === "grid" ? (
        <FileGrid {...props} />
      ) : (
        <FileList {...props} />
      )}
    </div>
  );
};
