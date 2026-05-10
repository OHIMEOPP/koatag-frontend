import React, { useEffect, useState } from "react";
import { listFolders, DriveFolder } from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { useDialogEsc } from "hooks/useDialogEsc";

interface MoveDialogProps {
  itemId: number;
  itemKind: "file" | "folder";
  itemName: string;
  currentParentId: number | null;
  onSubmit: (targetFolderId: number | null) => void | Promise<void>;
  onClose: () => void;
}

export const MoveDialog: React.FC<MoveDialogProps> = ({
  itemId,
  itemKind,
  itemName,
  currentParentId,
  onSubmit,
  onClose,
}) => {
  const [stack, setStack] = useState<DriveFolder[]>([]);
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const currentId = stack.length === 0 ? null : stack[stack.length - 1].id;
  const isCurrentLocation = currentId === currentParentId;

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setErr(null);
    listFolders(currentId)
      .then((list) => {
        if (aborted) return;
        setFolders(list);
        setLoading(false);
      })
      .catch((e) => {
        if (aborted) return;
        setErr(mapDriveError(e));
        setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [currentId]);

  useDialogEsc(onClose);

  const enter = (f: DriveFolder) => setStack([...stack, f]);
  const goRoot = () => setStack([]);
  const goToIndex = (idx: number) => setStack(stack.slice(0, idx + 1));

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(currentId);
      onClose();
    } catch (e: any) {
      setErr(e?.message ?? "移動失敗");
      setSubmitting(false);
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div
        className="drive-modal drive-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="drive-modal-title">移動「{itemName}」</div>
        <div className="drive-modal-breadcrumb">
          <button type="button" className="drive-modal-crumb" onClick={goRoot}>
            🏠 根
          </button>
          {stack.map((f, idx) => (
            <React.Fragment key={f.id}>
              <span className="drive-modal-crumb-sep">/</span>
              <button
                type="button"
                className="drive-modal-crumb"
                onClick={() => goToIndex(idx)}
              >
                {f.name}
              </button>
            </React.Fragment>
          ))}
        </div>
        <div className="drive-modal-folder-list">
          {loading ? (
            <div className="drive-modal-loading">載入中…</div>
          ) : folders.length === 0 ? (
            <div className="drive-modal-empty">此處沒有子資料夾</div>
          ) : (
            folders.map((f) => {
              const isSelf = itemKind === "folder" && f.id === itemId;
              return (
                <button
                  type="button"
                  key={f.id}
                  className={`drive-modal-folder-item ${isSelf ? "drive-modal-folder-item-disabled" : ""}`}
                  disabled={isSelf}
                  title={isSelf ? "不能移動到自己" : ""}
                  onClick={() => enter(f)}
                >
                  📁 {f.name}
                </button>
              );
            })
          )}
        </div>
        {err && <div className="drive-modal-error">{err}</div>}
        <div className="drive-modal-actions">
          <button
            type="button"
            className="drive-modal-btn"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="button"
            className="drive-modal-btn drive-modal-btn-primary"
            onClick={submit}
            disabled={submitting || isCurrentLocation}
            title={isCurrentLocation ? "已在此位置" : ""}
          >
            {submitting ? "處理中…" : "移到此處"}
          </button>
        </div>
      </div>
    </div>
  );
};
