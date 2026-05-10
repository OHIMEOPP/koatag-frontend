import { useEffect } from "react";
import { useUploadQueueStore } from "stores/uploadQueueStore";
import { useDriveQuotaStore } from "stores/driveQuotaStore";
import { useFolderTreeStore } from "stores/folderTreeStore";
import { uploadFile, DriveServiceError } from "services/drive.service";

const MAX_CONCURRENT = 3;

/**
 * useUploadScheduler — 並行上傳 worker（spec §5.3）
 *
 * - 監聽 uploadQueueStore.queue
 * - 拉 pending → 設 status='uploading' + abortController
 * - call uploadFile(file, folderId, onProgress, signal)
 * - 成功 → setResult + 重撈 quota + invalidate folder
 * - 失敗 → setError (依 DriveServiceError code 或 abort 略過)
 *
 * MVP max 3 concurrent；mount 在 DrivePage（user 切走後 in-flight 仍會
 * commit store，新 pending 等下次 mount 才 schedule）。
 *
 * Spec §11.3 寫掛 App.tsx root，但會破壞 Drive lazy load 收益，
 * 折衷：DrivePage layer 啟動。
 */
export function useUploadScheduler(): void {
  const queue = useUploadQueueStore((s) => s.queue);
  const setStatus = useUploadQueueStore((s) => s.setStatus);
  const setProgress = useUploadQueueStore((s) => s.setProgress);
  const setResult = useUploadQueueStore((s) => s.setResult);
  const setError = useUploadQueueStore((s) => s.setError);
  const setAbortController = useUploadQueueStore((s) => s.setAbortController);
  const fetchQuota = useDriveQuotaStore((s) => s.fetch);
  const invalidateFolder = useFolderTreeStore((s) => s.invalidate);

  useEffect(() => {
    const uploading = queue.filter((q) => q.status === "uploading").length;
    const slots = MAX_CONCURRENT - uploading;
    if (slots <= 0) return;

    const pending = queue.filter((q) => q.status === "pending").slice(0, slots);
    if (pending.length === 0) return;

    pending.forEach((item) => {
      const ctrl = new AbortController();
      setStatus(item.id, "uploading");
      setAbortController(item.id, ctrl);

      uploadFile(
        item.file,
        item.folderId,
        (loaded, total) => {
          const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
          setProgress(item.id, pct);
        },
        ctrl.signal,
      )
        .then((file) => {
          setResult(item.id, file);
          // upload success → quota 變動 + folder list 變動，invalidate 兩個 store
          fetchQuota();
          invalidateFolder();
        })
        .catch((err) => {
          // axios CanceledError / AbortError → cancel() 已 set status='error' code='CANCELLED'
          if (err?.name === "CanceledError" || err?.name === "AbortError") {
            return;
          }
          if (err instanceof DriveServiceError) {
            setError(item.id, err.code, err.message);
          } else {
            const msg = err instanceof Error ? err.message : String(err);
            setError(item.id, "UNKNOWN", msg);
          }
        });
    });
  }, [
    queue,
    setStatus,
    setProgress,
    setResult,
    setError,
    setAbortController,
    fetchQuota,
    invalidateFolder,
  ]);
}
