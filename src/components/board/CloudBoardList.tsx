import React, { useEffect, useState } from 'react';
import { useDialogEsc } from 'hooks/useDialogEsc';
import { ConfirmDialog } from 'components/drive';
import { $message } from 'utils';
import { CloudBoardRow, deleteCloudBoard, listCloudBoards, renameCloudBoard } from 'services/board.service';

type Props = {
  title: string;
  // 每一筆主要按鈕的文字，載入目前黑板或開新視窗
  pickLabel: string;
  onPick: (row: CloudBoardRow) => void;
  // 改名、刪除後通知黑板，來源剛好是這筆時要跟著更新
  onRenamed: (id: number, name: string) => void;
  onDeleted: (id: number) => void;
  onClose: () => void;
};

// 存檔時間顯示成本地時間
const formatTime = (text: string): string => {
  const d = new Date(text);
  if (isNaN(d.getTime())) {
    return text;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 雲端存檔清單，可選一筆、改名、刪除
export const CloudBoardList: React.FC<Props> = ({ title, pickLabel, onPick, onRenamed, onDeleted, onClose }) => {
  // 按過刪除、等確認框回覆的那筆
  const [deletingRow, setDeletingRow] = useState<CloudBoardRow | null>(null);

  // 確認框開著時 Esc 只關確認框，不連清單一起關
  useDialogEsc(deletingRow ? () => setDeletingRow(null) : onClose);

  const [rows, setRows] = useState<CloudBoardRow[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  // 正在改名的那筆與輸入中的名稱
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listCloudBoards(page)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setRows(response.data);
        setLastPage(response.meta.last_page || 1);
      })
      .catch(() => {
        if (!cancelled) {
          $message('讀取雲端存檔失敗', 'error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, reloadTick]);

  const startRename = (row: CloudBoardRow) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const submitRename = async (e: React.FormEvent, row: CloudBoardRow) => {
    e.preventDefault();
    const name = editName.trim();
    if (!name || name === row.name) {
      setEditingId(null);
      return;
    }
    try {
      await renameCloudBoard(row.id, name);
      onRenamed(row.id, name);
      setEditingId(null);
      setReloadTick((t) => t + 1);
    } catch (err) {
      $message('改名失敗', 'error');
    }
  };

  // 確認框按下刪除時呼叫，失敗時丟錯，確認框會留著顯示錯誤
  const confirmDelete = async (row: CloudBoardRow) => {
    try {
      await deleteCloudBoard(row.id);
    } catch (err) {
      throw new Error('刪除失敗，稍後再試');
    }
    onDeleted(row.id);
    // 這頁刪光了就回上一頁
    if (rows.length === 1 && page > 1) {
      setPage(page - 1);
    } else {
      setReloadTick((t) => t + 1);
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal board-cloud" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">{title}</div>

        <div className="board-cloud-list">
          {loading && <div className="board-picker-empty">載入中…</div>}
          {!loading && rows.length === 0 && <div className="board-picker-empty">還沒有雲端存檔</div>}
          {!loading && rows.map((row) => (
            <div key={row.id} className="board-cloud-row">
              <div className="board-cloud-info">
                {editingId === row.id ? (
                  <form onSubmit={(e) => submitRename(e, row)}>
                    <input
                      className="board-input"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onBlur={() => setEditingId(null)}
                      maxLength={100}
                      autoFocus
                    />
                  </form>
                ) : (
                  <div className="board-cloud-name">{row.name}</div>
                )}
                <div className="board-cloud-meta">
                  {row.item_count} 張 · {formatTime(row.created_at)}
                </div>
              </div>

              <div className="board-cloud-actions">
                <button
                  type="button"
                  className="board-btn board-btn-danger"
                  onClick={() => {
                    setEditingId(null);
                    setDeletingRow(row);
                  }}
                >
                  刪除
                </button>
                <button type="button" className="board-btn" onClick={() => startRename(row)}>改名</button>
                <button type="button" className="board-btn board-btn-primary" onClick={() => onPick(row)}>
                  {pickLabel}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="board-picker-pager">
          <button type="button" className="drive-modal-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            上一頁
          </button>
          <span>{page} / {lastPage}</span>
          <button type="button" className="drive-modal-btn" disabled={page >= lastPage || loading} onClick={() => setPage(page + 1)}>
            下一頁
          </button>
        </div>

        <div className="drive-modal-actions">
          <button type="button" className="drive-modal-btn" onClick={onClose}>關閉</button>
        </div>
      </div>

      {deletingRow && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmDialog
            title="刪除存檔"
            message={`確定刪除「${deletingRow.name}」？刪除後無法復原。`}
            confirmLabel="刪除"
            destructive
            onConfirm={() => confirmDelete(deletingRow)}
            onClose={() => setDeletingRow(null)}
          />
        </div>
      )}
    </div>
  );
};
