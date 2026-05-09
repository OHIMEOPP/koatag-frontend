import React, { useCallback, useEffect } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useFolderTreeStore } from "stores/folderTreeStore";
import { useDriveQuotaStore } from "stores/driveQuotaStore";
import { Breadcrumb, FileListPanel, SortMenu, SearchBar, UploadDropzone } from "components/drive";
import { DriveFile, DriveFolder, SortKey, SortOrder } from "services/drive.service";

/**
 * KOATAG Drive 入口頁
 *
 * T4 skeleton + T5 list / breadcrumb / view toggle。後續：
 * - T6: FileCard / FolderCard 真 thumb (依賴 B17 backend up)
 * - T7: SortMenu + SearchBar
 * - T8: UploadDropzone
 * - T9: UploadProgressList + scheduler
 * - T10: QuotaIndicator
 * - T11: ContextMenu
 * - T12: VideoPlayer
 * - T13: DriveFilePage
 */
const DrivePage: React.FC = () => {
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
      <Route path="" element={<DriveContentView folderId={null} />} />
      <Route path="folder/:id" element={<DriveFolderRoute />} />
    </Routes>
  );
};

const DriveFolderRoute: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const folderId = id ? Number(id) : NaN;
  if (Number.isNaN(folderId)) {
    return <div className="drive-page"><div className="drive-error">資料夾 ID 無效</div></div>;
  }
  return <DriveContentView folderId={folderId} />;
};

const DriveContentView: React.FC<{ folderId: number | null }> = ({ folderId }) => {
  const navigate = useNavigate();
  const setCurrent = useFolderTreeStore((s) => s.setCurrent);
  const setViewOpts = useFolderTreeStore((s) => s.setViewOpts);
  const folders = useFolderTreeStore((s) => s.folders);
  const files = useFolderTreeStore((s) => s.files);
  const breadcrumb = useFolderTreeStore((s) => s.breadcrumb);
  const viewOpts = useFolderTreeStore((s) => s.viewOpts);
  const loading = useFolderTreeStore((s) => s.loading);
  const error = useFolderTreeStore((s) => s.error);

  useEffect(() => {
    setCurrent(folderId);
  }, [folderId, setCurrent]);

  // useCallback 穩定 ref，避免 SearchBar useEffect dep 變動觸發 timer reset
  // (wiki T7 review finding A) — DrivePage 6 個 selector，任一變動 re-render
  // 重新 gen closure 會讓 SearchBar 永遠 timer 重啟、search 不發送
  const handleOpen = useCallback(
    (item: DriveFile | DriveFolder, kind: "file" | "folder") => {
      if (kind === "folder") {
        navigate(`/main/drive/folder/${item.id}`);
      } else {
        // T13 才接 file detail page；MVP placeholder
        console.log("[drive] open file (T13 wires to /main/drive/file/:id):", item.id);
      }
    },
    [navigate],
  );

  const handleBreadcrumbNavigate = useCallback(
    (id: number | null) => {
      if (id == null) navigate("/main/drive");
      else navigate(`/main/drive/folder/${id}`);
    },
    [navigate],
  );

  const handleSortChange = useCallback(
    (sort: SortKey, order: SortOrder) => {
      setViewOpts({ sort, order, page: 1 });
    },
    [setViewOpts],
  );

  const handleQueryChange = useCallback(
    (q: string) => {
      setViewOpts({ q: q || undefined, page: 1 });
    },
    [setViewOpts],
  );

  return (
    <UploadDropzone folderId={folderId}>
      <div className="drive-page">
        <Breadcrumb ancestors={breadcrumb} onNavigate={handleBreadcrumbNavigate} />
        <div className="drive-toolbar">
          <SearchBar query={viewOpts.q ?? ""} onQueryChange={handleQueryChange} />
          <SortMenu
            sort={viewOpts.sort ?? "name"}
            order={viewOpts.order ?? "asc"}
            onChange={handleSortChange}
          />
        </div>
        {error ? (
          <div className="drive-error">{error}</div>
        ) : loading ? (
          <div className="drive-loading">載入中…</div>
        ) : (
          <FileListPanel folders={folders} files={files} onItemOpen={handleOpen} />
        )}
      </div>
    </UploadDropzone>
  );
};

export default DrivePage;
export { DrivePage };
