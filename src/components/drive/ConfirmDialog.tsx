import React, { useState } from "react";
import { useDialogEsc } from "hooks/useDialogEsc";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** confirm 按下時呼叫；throw 時 dialog 留住顯示 err，user 自己決定 cancel */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

/**
 * 取代 `window.confirm` — 跟 RenameDialog / MoveDialog 同一深色 modal style。
 * destructive 旗標把 confirm button 變紅色（適合 delete 場景）。
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  title,
  message,
  confirmLabel = "確認",
  cancelLabel = "取消",
  destructive = false,
  onConfirm,
  onClose,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useDialogEsc(onClose);

  const handleConfirm = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "操作失敗");
      setSubmitting(false);
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">{title}</div>
        <div className="drive-modal-message">{message}</div>
        {err && <div className="drive-modal-error">{err}</div>}
        <div className="drive-modal-actions">
          <button
            type="button"
            className="drive-modal-btn"
            onClick={onClose}
            disabled={submitting}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`drive-modal-btn ${destructive ? "drive-modal-btn-destructive" : "drive-modal-btn-primary"}`}
            onClick={handleConfirm}
            disabled={submitting}
            autoFocus
          >
            {submitting ? "處理中…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
