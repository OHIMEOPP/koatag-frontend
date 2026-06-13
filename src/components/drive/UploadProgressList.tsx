import React, { useState } from "react";
import {
  useUploadQueueStore,
  UploadItem,
  MAX_UPLOAD_RETRIES,
} from "stores/uploadQueueStore";
import { formatBytes } from "./FileGrid";

// D.16: 顯 speed + ETA 的 size 門檻 — 小檔 fluctuation 大，乾脆不顯
const ETA_MIN_FILE_BYTES = 1024 * 1024;

export const UploadProgressList: React.FC = () => {
  const queue = useUploadQueueStore((s) => s.queue);
  const cancel = useUploadQueueStore((s) => s.cancel);
  const retry = useUploadQueueStore((s) => s.retry);
  const remove = useUploadQueueStore((s) => s.remove);
  const clearDone = useUploadQueueStore((s) => s.clearDone);
  const [collapsed, setCollapsed] = useState(false);

  if (queue.length === 0) return null;

  const doneCount = queue.filter((q) => q.status === "done").length;
  const errorCount = queue.filter((q) => q.status === "error").length;
  const activeCount = queue.length - doneCount - errorCount;

  return (
    <div className="drive-upload-list" role="region" aria-label="上傳佇列">
      <div className="drive-upload-list-header">
        <div className="drive-upload-list-summary">
          上傳：
          {activeCount > 0 && <span>{activeCount} 進行中</span>}
          {doneCount > 0 && <span className="drive-upload-list-done">{doneCount} 完成</span>}
          {errorCount > 0 && <span className="drive-upload-list-failed">{errorCount} 失敗</span>}
        </div>
        <div className="drive-upload-list-actions">
          {doneCount > 0 && (
            <button type="button" onClick={clearDone} className="drive-upload-list-btn">
              清除已完成
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="drive-upload-list-btn"
            aria-expanded={!collapsed}
          >
            {collapsed ? "展開" : "收合"}
          </button>
        </div>
      </div>
      {!collapsed && (
        <ul className="drive-upload-list-items">
          {queue.map((item) => (
            <UploadItemRow
              key={item.id}
              item={item}
              onCancel={() => cancel(item.id)}
              onRetry={() => retry(item.id)}
              onRemove={() => remove(item.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
};

interface UploadItemRowProps {
  item: UploadItem;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}

const UploadItemRow: React.FC<UploadItemRowProps> = ({ item, onCancel, onRetry, onRemove }) => {
  const isDone = item.status === "done";
  const isError = item.status === "error";
  const isUploading = item.status === "uploading";
  const isPending = item.status === "pending";
  const isRetryable = isError && item.errorCode !== "FILE_TOO_LARGE";
  const reachedMaxRetry = item.retryCount >= MAX_UPLOAD_RETRIES;

  // D.16: speed + ETA 計算（uploading 且檔 >= 1MB 才顯，避免 fluctuation 太大）
  // R2 #4 cutover — encrypt 階段 bytesSent 是加密進度非上傳速度，不顯 speed/ETA。
  const showEta =
    isUploading &&
    item.phase !== "encrypt" &&
    item.file.size >= ETA_MIN_FILE_BYTES &&
    item.startedAt != null &&
    item.bytesSent > 0;
  let speedLabel: string | null = null;
  let etaLabel: string | null = null;
  if (showEta && item.startedAt) {
    const elapsedSec = (Date.now() - item.startedAt) / 1000;
    if (elapsedSec > 0.5) {
      const speedBps = item.bytesSent / elapsedSec;
      speedLabel = `${formatBytes(Math.round(speedBps))}/s`;
      const remaining = Math.max(0, item.file.size - item.bytesSent);
      if (speedBps > 0) {
        const etaSec = Math.round(remaining / speedBps);
        etaLabel = formatEta(etaSec);
      }
    }
  }

  return (
    <li className={`drive-upload-item drive-upload-item-${item.status}`}>
      <div className="drive-upload-item-info">
        <div className="drive-upload-item-name" title={item.file.name}>
          {item.file.name}
          {item.retryCount > 0 && (
            <span
              className="drive-upload-item-retry-chip"
              title={`重試次數 ${item.retryCount} / ${MAX_UPLOAD_RETRIES}`}
            >
              ↻ {item.retryCount}
            </span>
          )}
        </div>
        <div className="drive-upload-item-meta">
          {formatBytes(item.file.size)}
          {speedLabel && <span> · {speedLabel}</span>}
          {etaLabel && <span> · 剩 {etaLabel}</span>}
          {isError && item.errorMessage && (
            <span className="drive-upload-item-error"> · {item.errorMessage}</span>
          )}
          {!isError && item.warnMessage && (
            <span className="drive-upload-item-warn"> · {item.warnMessage}</span>
          )}
        </div>
      </div>
      {(isUploading || isPending) && (
        <div className="drive-upload-item-progress">
          <div
            className="drive-upload-item-progress-bar"
            style={{ width: `${item.progress}%` }}
            role="progressbar"
            aria-valuenow={item.progress}
            aria-valuemin={0}
            aria-valuemax={100}
          />
          <span className="drive-upload-item-progress-text">
            {isPending
              ? "等待中"
              : item.phase === "encrypt"
                ? "加密中…"
                : `${item.progress}%`}
          </span>
        </div>
      )}
      <div className="drive-upload-item-actions">
        {(isUploading || isPending) && (
          <button type="button" onClick={onCancel} className="drive-upload-list-btn">
            取消
          </button>
        )}
        {isRetryable && (
          <button
            type="button"
            onClick={onRetry}
            className="drive-upload-list-btn"
            disabled={reachedMaxRetry}
            title={
              reachedMaxRetry
                ? `已重試 ${MAX_UPLOAD_RETRIES} 次，請手動重新選擇檔案`
                : `重試（已用 ${item.retryCount} / ${MAX_UPLOAD_RETRIES}）`
            }
          >
            重試
          </button>
        )}
        {(isDone || isError) && (
          <button
            type="button"
            onClick={onRemove}
            className="drive-upload-list-btn"
            aria-label="移除"
          >
            ×
          </button>
        )}
      </div>
    </li>
  );
};

function formatEta(sec: number): string {
  if (sec < 60) return `${sec} 秒`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m} 分 ${s} 秒`;
  const h = Math.floor(m / 60);
  return `${h} 小時 ${m % 60} 分`;
}
