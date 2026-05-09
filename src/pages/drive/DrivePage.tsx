import React, { useEffect } from "react";
import { Routes, Route, useParams } from "react-router-dom";
import { useFolderTreeStore } from "stores/folderTreeStore";
import { useDriveQuotaStore } from "stores/driveQuotaStore";

/**
 * KOATAG Drive 入口頁 — T4 skeleton
 *
 * MVP 階段只放 layout + store wire-up 骨架，實際 UI 元件 T5+ 才填：
 * - T5: Breadcrumb + FileGrid + FileList + view toggle
 * - T6: FileCard / FolderCard
 * - T7: SortMenu + SearchBar
 * - T8: UploadDropzone + 50MB guard
 * - T9: UploadProgressList + scheduler
 * - T10: QuotaIndicator
 * - T11: ContextMenu
 * - T12: VideoPlayer (依賴 B17 backend signed URL up)
 * - T13: DriveFilePage (lightbox / video player 整合)
 *
 * Routing：`/main/drive` 走 `<DrivePage>`，內部 nested:
 *  - ""           → DriveRootView (folderId = null)
 *  - "folder/:id" → DriveFolderView (folderId = :id)
 *  - "file/:id"   → 留 T13 才加
 */
const DrivePage: React.FC = () => {
  const setCurrent = useFolderTreeStore((s) => s.setCurrent);
  const reset = useFolderTreeStore((s) => s.reset);
  const fetchQuota = useDriveQuotaStore((s) => s.fetch);

  useEffect(() => {
    fetchQuota();
    return () => {
      reset();
    };
  }, [fetchQuota, reset]);

  return (
    <Routes>
      <Route path="" element={<DriveRootView setCurrent={setCurrent} />} />
      <Route path="folder/:id" element={<DriveFolderView setCurrent={setCurrent} />} />
    </Routes>
  );
};

const DriveRootView: React.FC<{ setCurrent: (id: number | null) => Promise<void> }> = ({
  setCurrent,
}) => {
  useEffect(() => {
    setCurrent(null);
  }, [setCurrent]);

  return (
    <div className="drive-page">
      <div className="drive-placeholder">
        <h2>Drive — 根目錄</h2>
        <p>TODO: Breadcrumb / FileGrid / Upload / QuotaIndicator (T5+)</p>
      </div>
    </div>
  );
};

const DriveFolderView: React.FC<{
  setCurrent: (id: number | null) => Promise<void>;
}> = ({ setCurrent }) => {
  const { id } = useParams<{ id: string }>();
  const folderId = id ? Number(id) : null;

  useEffect(() => {
    if (folderId != null && !Number.isNaN(folderId)) {
      setCurrent(folderId);
    }
  }, [folderId, setCurrent]);

  return (
    <div className="drive-page">
      <div className="drive-placeholder">
        <h2>Drive — 資料夾 #{folderId ?? "?"}</h2>
        <p>TODO: Breadcrumb / FileGrid / Upload (T5+)</p>
      </div>
    </div>
  );
};

export default DrivePage;
export { DrivePage };
