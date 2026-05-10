import React, { useCallback, useEffect, useState } from "react";
import { Routes, Route, useParams, useNavigate } from "react-router-dom";
import { useFolderTreeStore } from "stores/folderTreeStore";
import { useDriveQuotaStore } from "stores/driveQuotaStore";
import {
  Breadcrumb,
  FileListPanel,
  SortMenu,
  SearchBar,
  UploadDropzone,
  UploadProgressList,
  ContextMenu,
  ContextMenuAction,
  RenameDialog,
  MoveDialog,
  ConfirmDialog,
  ShareDialog,
} from "components/drive";
import {
  DriveFile,
  DriveFolder,
  SortKey,
  SortOrder,
  deleteFile,
  deleteFolder,
  renameOrMove,
  downloadUrl,
} from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { useUploadScheduler } from "hooks/useUploadScheduler";
import DriveFilePage from "./DriveFilePage";
import SharedWithMePage from "./SharedWithMePage";
import MySharesPage from "./MySharesPage";

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

  // 啟動上傳並行 scheduler (max 3)，user 在 Drive 期間運作
  useUploadScheduler();

  useEffect(() => {
    fetchQuota();
    return () => {
      reset();
    };
  }, [fetchQuota, reset]);

  return (
    <>
      <Routes>
        <Route path="" element={<DriveContentView folderId={null} />} />
        <Route path="folder/:id" element={<DriveFolderRoute />} />
        <Route path="file/:id" element={<DriveFilePage />} />
        <Route path="shared/in" element={<SharedWithMePage />} />
        <Route path="shared/out" element={<MySharesPage />} />
      </Routes>
      <UploadProgressList />
    </>
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

type CtxItem = { item: DriveFile | DriveFolder; kind: "file" | "folder" };
type ModalState =
  | { type: "rename"; ctx: CtxItem }
  | { type: "move"; ctx: CtxItem }
  | { type: "delete"; ctx: CtxItem }
  | { type: "share"; ctx: CtxItem }
  | null;

const DriveContentView: React.FC<{ folderId: number | null }> = ({ folderId }) => {
  const navigate = useNavigate();
  const setCurrent = useFolderTreeStore((s) => s.setCurrent);
  const setViewOpts = useFolderTreeStore((s) => s.setViewOpts);
  const invalidateTree = useFolderTreeStore((s) => s.invalidate);
  const invalidateQuota = useDriveQuotaStore((s) => s.invalidate);
  const quota = useDriveQuotaStore((s) => s.quota);
  const folders = useFolderTreeStore((s) => s.folders);
  const files = useFolderTreeStore((s) => s.files);
  const breadcrumb = useFolderTreeStore((s) => s.breadcrumb);
  const viewOpts = useFolderTreeStore((s) => s.viewOpts);
  const loading = useFolderTreeStore((s) => s.loading);
  const error = useFolderTreeStore((s) => s.error);

  const [ctx, setCtx] = useState<{ ctx: CtxItem; pos: { x: number; y: number } } | null>(null);
  const [modal, setModal] = useState<ModalState>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
        navigate(`/main/drive/file/${item.id}`);
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

  const handleContextMenu = useCallback(
    (item: DriveFile | DriveFolder, kind: "file" | "folder", e: React.MouseEvent) => {
      setCtx({ ctx: { item, kind }, pos: { x: e.clientX, y: e.clientY } });
    },
    [],
  );

  const performAction = useCallback(
    async (action: ContextMenuAction, target: CtxItem) => {
      const { item, kind } = target;
      try {
        if (action === "open") {
          handleOpen(item, kind);
        } else if (action === "download") {
          if (kind !== "file") return;
          const url = await downloadUrl(item.id);
          window.open(url, "_blank", "noopener");
        } else if (action === "rename") {
          setModal({ type: "rename", ctx: target });
        } else if (action === "move") {
          setModal({ type: "move", ctx: target });
        } else if (action === "delete") {
          setModal({ type: "delete", ctx: target });
        } else if (action === "share") {
          setModal({ type: "share", ctx: target });
        }
      } catch (err) {
        setActionError(mapDriveError(err));
      }
    },
    [handleOpen, invalidateTree, invalidateQuota],
  );

  const handleAction = useCallback(
    (action: ContextMenuAction) => {
      if (!ctx) return;
      const target = ctx.ctx;
      setCtx(null);
      void performAction(action, target);
    },
    [ctx, performAction],
  );

  return (
    <UploadDropzone folderId={folderId} disabled={quota ? quota.ratio >= 1 : false}>
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
        {actionError && (
          <div className="drive-error" onClick={() => setActionError(null)}>
            {actionError}（點擊關閉）
          </div>
        )}
        {error ? (
          <div className="drive-error">{error}</div>
        ) : loading ? (
          <div className="drive-loading">載入中…</div>
        ) : (
          <FileListPanel
            folders={folders}
            files={files}
            onItemOpen={handleOpen}
            onItemContextMenu={handleContextMenu}
          />
        )}
      </div>
      {ctx && (
        <ContextMenu
          item={ctx.ctx.item}
          kind={ctx.ctx.kind}
          position={ctx.pos}
          onAction={handleAction}
          onClose={() => setCtx(null)}
        />
      )}
      {modal?.type === "rename" && (
        <RenameDialog
          initialName={modal.ctx.item.name}
          onClose={() => setModal(null)}
          onSubmit={async (newName) => {
            await renameOrMove({
              resourceType: modal.ctx.kind,
              resourceId: modal.ctx.item.id,
              newName,
            });
            await invalidateTree();
          }}
        />
      )}
      {modal?.type === "share" && (
        <ShareDialog
          resourceType={modal.ctx.kind}
          resourceId={modal.ctx.item.id}
          resourceName={modal.ctx.item.name}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === "delete" && (
        <ConfirmDialog
          title="刪除確認"
          message={
            modal.ctx.kind === "folder"
              ? `確定刪除資料夾「${modal.ctx.item.name}」？（資料夾必須為空）`
              : `確定刪除檔案「${modal.ctx.item.name}」？此動作無法復原。`
          }
          confirmLabel="刪除"
          destructive
          onClose={() => setModal(null)}
          onConfirm={async () => {
            if (modal.ctx.kind === "file") {
              await deleteFile(modal.ctx.item.id);
            } else {
              await deleteFolder(modal.ctx.item.id);
            }
            await Promise.all([invalidateTree(), invalidateQuota()]);
          }}
        />
      )}
      {modal?.type === "move" && (
        <MoveDialog
          itemId={modal.ctx.item.id}
          itemKind={modal.ctx.kind}
          itemName={modal.ctx.item.name}
          currentParentId={
            modal.ctx.kind === "file"
              ? (modal.ctx.item as DriveFile).folder_id
              : (modal.ctx.item as DriveFolder).parent_id
          }
          onClose={() => setModal(null)}
          onSubmit={async (targetFolderId) => {
            await renameOrMove({
              resourceType: modal.ctx.kind,
              resourceId: modal.ctx.item.id,
              targetFolderId,
            });
            await invalidateTree();
          }}
        />
      )}
    </UploadDropzone>
  );
};

export default DrivePage;
export { DrivePage };
