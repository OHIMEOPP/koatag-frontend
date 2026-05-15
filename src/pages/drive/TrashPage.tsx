import React, { useEffect, useRef, useState } from "react";
import { useTrashStore } from "stores/trashStore";
import { useDriveQuotaStore } from "stores/driveQuotaStore";
import { TrashedFile } from "services/drive.service";
import { ConfirmDialog, getMimeIconText, formatBytes } from "components/drive";
import { Icon } from "components/Icon";
import { useDialogEsc } from "hooks/useDialogEsc";

/**
 * /main/drive/trash — v3 Trash UI (backend #498)
 *
 * 軟刪除後 30 天保留期，user 可 restore 或 permanent delete。
 * folder cascade trash 留 v? backlog；本頁僅 file。
 */
const TrashPage: React.FC = () => {
  const items = useTrashStore((s) => s.items);
  const meta = useTrashStore((s) => s.meta);
  const loading = useTrashStore((s) => s.loading);
  const error = useTrashStore((s) => s.error);
  const fetchPage = useTrashStore((s) => s.fetchPage);
  const restore = useTrashStore((s) => s.restore);
  const permanentDelete = useTrashStore((s) => s.permanentDelete);
  const reset = useTrashStore((s) => s.reset);
  const fetchQuota = useDriveQuotaStore((s) => s.fetch);

  const [pending, setPending] = useState<TrashedFile | null>(null);
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // dispatch §3：右鍵 trash item 出 ctxmenu — 只 Restore / Permanent Delete 兩 action
  const [ctx, setCtx] = useState<{ item: TrashedFile; x: number; y: number } | null>(null);

  useEffect(() => {
    fetchPage();
    return () => reset();
  }, [fetchPage, reset]);

  const onRestore = async (file: TrashedFile) => {
    setRestoringId(file.id);
    try {
      await restore(file.id);
      // cascade caveat: soft-delete 時 share/share_link 已 cascade revoke，
      // restore 不自動回（per wiki #508 / contract spec §7.6b）
      setToast(
        `已還原至 /主目錄：${file.name}（⚠ 還原前的分享連結需重新設定）`,
      );
    } catch {
      // store 內 error state 已更新
    } finally {
      setRestoringId(null);
    }
  };

  const onPermanentConfirm = async () => {
    if (!pending) return;
    try {
      const result = await permanentDelete(pending.id);
      setToast(`已永久刪除「${pending.name}」— 釋放 ${formatBytes(result.released_bytes)}`);
      // quota 即時 refresh — 釋放後 used_bytes 應減
      fetchQuota();
    } catch {
      // store 內 error state 已更新
    } finally {
      setPending(null);
    }
  };

  const pageNum = meta?.page ?? 1;
  const totalPages = meta?.total_pages ?? 1;

  return (
    <div className="drive-page">
      <h2 className="drive-page-title">
        <Icon.trash size={18} /> 垃圾桶
      </h2>
      <p className="drive-trash-hint">
        檔案在垃圾桶保留 30 天後永久刪除。資料夾尚未支援垃圾桶（cascade 移除）。
      </p>
      {error && <div className="drive-error">{error}</div>}
      {toast && (
        <div className="drive-share-trace" onClick={() => setToast(null)}>
          {toast}（點擊關閉）
        </div>
      )}
      {loading && items.length === 0 ? (
        <div className="drive-loading">載入中…</div>
      ) : items.length === 0 ? (
        <div className="drive-empty">垃圾桶是空的</div>
      ) : (
        <table className="drive-list">
          <thead>
            <tr>
              <th aria-label="icon" />
              <th>名稱</th>
              <th>大小</th>
              <th>已刪除</th>
              <th>剩餘保留</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            {items.map((it) => {
              const restoring = restoringId === it.id;
              const warn = it.days_remaining <= 7;
              const deletedAgo = formatDeletedAgo(it.deleted_at);
              return (
                <tr
                  key={it.id}
                  className={warn ? "drive-trash-warn" : undefined}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setCtx({ item: it, x: e.clientX, y: e.clientY });
                  }}
                >
                  <td>{getMimeIconText(it.mime)}</td>
                  <td>{it.name}</td>
                  <td>{formatBytes(it.size_bytes)}</td>
                  <td>{deletedAgo}</td>
                  <td>
                    {warn ? "⚠ " : ""}
                    {it.days_remaining > 0
                      ? `剩 ${it.days_remaining} 天`
                      : "今日將刪除"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="drive-modal-btn"
                      onClick={() => onRestore(it)}
                      disabled={restoring}
                    >
                      還原
                    </button>
                    <button
                      type="button"
                      className="drive-modal-btn drive-modal-btn-danger"
                      onClick={() => setPending(it)}
                    >
                      永久刪除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {meta && totalPages > 1 && (
        <div className="drive-trash-pager">
          <button
            type="button"
            className="drive-modal-btn"
            disabled={pageNum <= 1 || loading}
            onClick={() => fetchPage({ page: pageNum - 1 })}
          >
            上一頁
          </button>
          <span>
            第 {pageNum} / {totalPages} 頁（共 {meta.total} 件）
          </span>
          <button
            type="button"
            className="drive-modal-btn"
            disabled={pageNum >= totalPages || loading}
            onClick={() => fetchPage({ page: pageNum + 1 })}
          >
            下一頁
          </button>
        </div>
      )}
      {ctx && (
        <TrashContextMenu
          position={{ x: ctx.x, y: ctx.y }}
          onRestore={() => {
            const it = ctx.item;
            setCtx(null);
            onRestore(it);
          }}
          onPermanent={() => {
            const it = ctx.item;
            setCtx(null);
            setPending(it);
          }}
          onClose={() => setCtx(null)}
        />
      )}
      {pending && (
        <ConfirmDialog
          title="永久刪除"
          message={`此操作不可復原。「${pending.name}」(${formatBytes(pending.size_bytes)}) 將從伺服器移除並釋放配額。確定刪除？`}
          confirmLabel="永久刪除"
          destructive
          onClose={() => setPending(null)}
          onConfirm={onPermanentConfirm}
        />
      )}
    </div>
  );
};

const TrashContextMenu: React.FC<{
  position: { x: number; y: number };
  onRestore: () => void;
  onPermanent: () => void;
  onClose: () => void;
}> = ({ position, onRestore, onPermanent, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  useDialogEsc(onClose);
  useEffect(() => {
    const handleDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleDoc);
    return () => document.removeEventListener("mousedown", handleDoc);
  }, [onClose]);
  const style: React.CSSProperties = {
    left: Math.min(position.x, window.innerWidth - 200),
    top: Math.min(position.y, window.innerHeight - 120),
  };
  return (
    <div className="drive-ctxmenu" style={style} ref={ref} role="menu">
      <button
        type="button"
        className="drive-ctxmenu-item"
        onClick={onRestore}
        role="menuitem"
      >
        <Icon.refresh size={14} />
        <span>還原</span>
      </button>
      <button
        type="button"
        className="drive-ctxmenu-item drive-ctxmenu-item-destructive"
        onClick={onPermanent}
        role="menuitem"
      >
        <Icon.trash size={14} />
        <span>永久刪除</span>
      </button>
    </div>
  );
};

function formatDeletedAgo(deletedAt: string): string {
  const t = new Date(deletedAt).getTime();
  if (Number.isNaN(t)) return deletedAt;
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "今天";
  if (days === 1) return "1 天前";
  return `${days} 天前`;
}

export default TrashPage;
export { TrashPage };
