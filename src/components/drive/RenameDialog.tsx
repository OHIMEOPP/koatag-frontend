import React, { useEffect, useState } from "react";

interface RenameDialogProps {
  initialName: string;
  onSubmit: (newName: string) => void | Promise<void>;
  onClose: () => void;
}

export const RenameDialog: React.FC<RenameDialogProps> = ({ initialName, onSubmit, onClose }) => {
  const [name, setName] = useState(initialName);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("名稱不可為空");
      return;
    }
    if (trimmed === initialName) {
      onClose();
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "重新命名失敗");
      setSubmitting(false);
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">重新命名</div>
        <input
          type="text"
          className="drive-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          autoFocus
          disabled={submitting}
          maxLength={255}
        />
        {err && <div className="drive-modal-error">{err}</div>}
        <div className="drive-modal-actions">
          <button className="drive-modal-btn" onClick={onClose} disabled={submitting}>取消</button>
          <button
            className="drive-modal-btn drive-modal-btn-primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "處理中…" : "確認"}
          </button>
        </div>
      </div>
    </div>
  );
};
