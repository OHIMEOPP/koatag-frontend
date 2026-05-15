import React, { useState } from "react";
import { useDialogEsc } from "hooks/useDialogEsc";

interface NewFolderDialogProps {
  // 顯示於 title 提示當前位置（root = "Drive" / 子資料夾 = parent name）
  parentLabel: string;
  onSubmit: (name: string) => void | Promise<void>;
  onClose: () => void;
}

// D.14: 沿用 RenameDialog 視覺 + 互動 pattern（Enter submit / ESC close / overlay click close）
export const NewFolderDialog: React.FC<NewFolderDialogProps> = ({
  parentLabel,
  onSubmit,
  onClose,
}) => {
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useDialogEsc(onClose);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErr("名稱不可為空");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "建立資料夾失敗");
      setSubmitting(false);
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">在「{parentLabel}」新增資料夾</div>
        <input
          type="text"
          className="drive-modal-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="資料夾名稱"
          autoFocus
          disabled={submitting}
          maxLength={255}
        />
        {err && <div className="drive-modal-error">{err}</div>}
        <div className="drive-modal-actions">
          <button className="drive-modal-btn" onClick={onClose} disabled={submitting}>
            取消
          </button>
          <button
            className="drive-modal-btn drive-modal-btn-primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "建立中…" : "建立"}
          </button>
        </div>
      </div>
    </div>
  );
};
