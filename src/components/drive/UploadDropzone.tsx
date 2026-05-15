import React, { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { useUploadQueueStore } from "stores/uploadQueueStore";

interface UploadDropzoneProps {
  folderId: number | null;
  children: React.ReactNode;
  /** 是否禁用拖拽（例如 quota 滿時 component-level 開關） */
  disabled?: boolean;
}

/**
 * UploadDropzone — wrap whole DrivePage children
 *
 * - drag over → 全頁 overlay 顯示「拖入以上傳」
 * - drop → 每個 File 進 uploadQueueStore.enqueue()
 *   - 2GB guard（D.12）在 store enqueue 內做（spec §5.1）：超過 → 入 queue with status='error', code='FILE_TOO_LARGE'
 *   - 後端 size check 是 last resort（spec §5.1 defense in depth）
 * - click 不觸發 file picker（drag-only 模式，避免誤觸；要 picker 走 button）
 *
 * 並行 worker (max 3) 留 T9 useUploadScheduler。
 */
export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  folderId,
  children,
  disabled = false,
}) => {
  const enqueue = useUploadQueueStore((s) => s.enqueue);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      acceptedFiles.forEach((file) => enqueue(file, folderId));
    },
    [enqueue, folderId],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
    noKeyboard: true,
    disabled,
  });

  return (
    <div {...getRootProps()} className="drive-dropzone-root">
      <input {...getInputProps()} />
      {children}
      {isDragActive && (
        <div className="drive-dropzone-overlay">
          <div className="drive-dropzone-overlay-message">
            拖入以上傳到當前資料夾
          </div>
        </div>
      )}
    </div>
  );
};
