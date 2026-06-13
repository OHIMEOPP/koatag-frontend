import { useEffect, useRef } from "react";
import { useUploadQueueStore } from "stores/uploadQueueStore";
import { useDriveQuotaStore } from "stores/driveQuotaStore";
import { useFolderTreeStore } from "stores/folderTreeStore";
import { uploadFileSmart, DriveServiceError } from "services/drive.service";

const MAX_CONCURRENT = 3;
// D.16: progress 事件 250ms throttle — 大檔 onUploadProgress 100+ fires/sec
// 不 throttle 會 jank（store update → React re-render 全 queue）。
const PROGRESS_THROTTLE_MS = 250;

/**
 * useUploadScheduler — 並行上傳 worker（spec §5.3）
 *
 * - 監聽 uploadQueueStore.queue
 * - 拉 pending → 設 status='uploading' + abortController
 * - call uploadFileSmart({ file, folderId, detectedMime, onProgress, onPhaseProgress, signal })
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
  const setProgressBytes = useUploadQueueStore((s) => s.setProgressBytes);
  const setPhase = useUploadQueueStore((s) => s.setPhase);
  const setStarted = useUploadQueueStore((s) => s.setStarted);
  const setResult = useUploadQueueStore((s) => s.setResult);
  const setError = useUploadQueueStore((s) => s.setError);
  const setAbortController = useUploadQueueStore((s) => s.setAbortController);
  const fetchQuota = useDriveQuotaStore((s) => s.fetch);
  const invalidateFolder = useFolderTreeStore((s) => s.invalidate);

  // D.16: per-item lastUpdate timestamp — onUploadProgress throttle
  // Ref 避免 dep 引爆 effect；scheduler 重新 mount 也乾淨。
  const lastUpdateRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const uploading = queue.filter((q) => q.status === "uploading").length;
    const slots = MAX_CONCURRENT - uploading;
    if (slots <= 0) return;

    const pending = queue.filter((q) => q.status === "pending").slice(0, slots);
    if (pending.length === 0) return;

    pending.forEach((item) => {
      const ctrl = new AbortController();
      setStatus(item.id, "uploading");
      setStarted(item.id);
      setAbortController(item.id, ctrl);
      lastUpdateRef.current.set(item.id, 0);

      // D.16 throttle：≥250ms 才寫 store；最後一筆（loaded===total）必 push。
      // R2 #4 cutover — onProgress（single/plaintext path）+ onPhaseProgress
      // （chunked path）共用同一條 throttled bytes/percent 寫入。
      const writeProgress = (loaded: number, total: number) => {
        const now = Date.now();
        const last = lastUpdateRef.current.get(item.id) ?? 0;
        const isFinal = total > 0 && loaded >= total;
        if (!isFinal && now - last < PROGRESS_THROTTLE_MS) return;
        lastUpdateRef.current.set(item.id, now);
        const pct = total > 0 ? Math.round((loaded / total) * 100) : 0;
        setProgressBytes(item.id, loaded, pct);
      };

      // R2 #4 cutover（fe-cutover §2.2.1）— uploadFile → uploadFileSmart：
      // masterPubkey 在 → EncryptedSingle/Chunked；缺 → throw KEYS_MISSING
      // （fallback split，§2.2.2 backstop）。detectedMime 餵入 ciphertext payload。
      uploadFileSmart({
        file: item.file,
        folderId: item.folderId,
        detectedMime: item.detectedMime,
        onProgress: writeProgress,
        onPhaseProgress: (phase, loaded, total) => {
          setPhase(item.id, phase);
          writeProgress(loaded, total);
        },
        signal: ctrl.signal,
      })
        .then((file) => {
          lastUpdateRef.current.delete(item.id);
          setResult(item.id, file);
          // upload success → quota 變動 + folder list 變動，invalidate 兩個 store
          fetchQuota();
          invalidateFolder();
        })
        .catch((err) => {
          lastUpdateRef.current.delete(item.id);
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
    setProgressBytes,
    setPhase,
    setStarted,
    setResult,
    setError,
    setAbortController,
    fetchQuota,
    invalidateFolder,
  ]);
}
