import React, { useState } from 'react';
import { useDialogEsc } from 'hooks/useDialogEsc';
import { BoardItem } from './types';
import { BoardSource } from 'services/board.service';

export type SaveMode = 'overwrite' | 'new';

type Props = {
  items: BoardItem[];
  // 黑板來自哪一筆存檔，有的話預設覆蓋它
  source: BoardSource | null;
  // 存好回 true，對話框才關
  onSave: (name: string, mode: SaveMode) => Promise<boolean>;
  onClose: () => void;
};

// 存到雲端前問名稱，黑板上有電腦檔案時提醒換台電腦看不到
export const CloudSaveDialog: React.FC<Props> = ({ items, source, onSave, onClose }) => {
  useDialogEsc(onClose);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  // 有來源預設覆蓋，沒有來源只能新增
  const [mode, setMode] = useState<SaveMode>(source ? 'overwrite' : 'new');

  let fileCount = 0;
  for (const it of items) {
    if (it.kind === 'file') {
      fileCount++;
    }
  }

  // 按按鈕或 Enter，照目前選的方式存
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) {
      return;
    }
    setSaving(true);
    const ok = await onSave(name, mode);
    setSaving(false);
    if (ok) {
      onClose();
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <form className="drive-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog">
        <div className="drive-modal-title">儲存</div>

        {source && (
          <div className="board-seg">
            <button
              type="button"
              className={mode === 'overwrite' ? 'active' : ''}
              onClick={() => setMode('overwrite')}
            >
              覆蓋儲存
            </button>
            <button
              type="button"
              className={mode === 'new' ? 'active' : ''}
              onClick={() => setMode('new')}
            >
              另存新檔
            </button>
          </div>
        )}

        {mode === 'new' && (
          <input
            className="board-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            placeholder="請輸入名稱，不填會自動取名"
            autoFocus
          />
        )}

        <div className="board-dialog-note">
          此黑板共有 {items.length} 張圖。
        </div>
        {fileCount > 0 && (
          <div className="bm-notice">
            請注意，{fileCount} 張是電腦檔案，切換電腦會顯示圖片遺失。
          </div>
        )}

        <div className="drive-modal-actions">
          <button type="button" className="drive-modal-btn" onClick={onClose}>取消</button>
          <button type="submit" className="drive-modal-btn drive-modal-btn-primary" disabled={saving}>
            {saving ? '存檔中…' : mode === 'overwrite' ? '覆蓋儲存' : '儲存'}
          </button>
        </div>
      </form>
    </div>
  );
};
