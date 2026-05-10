import React, { useEffect } from "react";
import { useDriveQuotaStore } from "stores/driveQuotaStore";
import { formatBytes } from "./FileGrid";

function tier(ratio: number): "ok" | "warn" | "full" {
  if (ratio >= 1) return "full";
  if (ratio >= 0.8) return "warn";
  return "ok";
}

export const QuotaIndicator: React.FC = () => {
  const quota = useDriveQuotaStore((s) => s.quota);
  const loading = useDriveQuotaStore((s) => s.loading);
  const fetchQuota = useDriveQuotaStore((s) => s.fetch);

  useEffect(() => {
    if (!quota && !loading) fetchQuota();
  }, [quota, loading, fetchQuota]);

  if (!quota) {
    return (
      <div className="drive-quota drive-quota-loading">
        <div className="drive-quota-label">Drive 容量</div>
        <div className="drive-quota-text">{loading ? "載入中…" : "未知"}</div>
      </div>
    );
  }

  const pct = Math.min(100, Math.round(quota.ratio * 100));
  const t = tier(quota.ratio);

  return (
    <div className={`drive-quota drive-quota-${t}`} title={`${formatBytes(quota.used_bytes)} / ${formatBytes(quota.quota_bytes)}`}>
      <div className="drive-quota-label">Drive 容量</div>
      <div className="drive-quota-bar">
        <div className="drive-quota-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="drive-quota-text">
        {formatBytes(quota.used_bytes)} / {formatBytes(quota.quota_bytes)}
        <span className="drive-quota-pct">（{pct}%）</span>
      </div>
    </div>
  );
};
