import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  getShareLanding,
  publicDownloadUrl,
  ShareLandingMeta,
} from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { formatBytes, getMimeIconText } from "components/drive";

/**
 * /main/drive/share/:token — public share-link landing（無 auth）
 *
 * 1. mount fetch GET /api/p/{token} — 拿 metadata（不消耗 use_count）
 * 2. file → 顯示檔名 + size + 下載按鈕（atomic consume → 走 publicDownloadUrl）
 * 3. folder → 顯示資料夾名 + 「資料夾下載 zip-on-fly 後續版本」note
 * 4. error code (SHARE_LINK_INVALID/EXPIRED/REVOKED/USED_UP) → 各自 inline 訊息
 *
 * 不繼承 Sidebar / RequireAuth — 是 public landing 獨立 layout。
 */
const ShareLinkLandingPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [meta, setMeta] = useState<ShareLandingMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setError("分享連結無效");
      setLoading(false);
      return;
    }
    let aborted = false;
    setLoading(true);
    setError(null);
    getShareLanding(token)
      .then((m) => {
        if (!aborted) {
          setMeta(m);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!aborted) {
          setError(mapDriveError(e));
          setLoading(false);
        }
      });
    return () => {
      aborted = true;
    };
  }, [token]);

  return (
    <div className="drive-public-landing">
      <div className="drive-public-card">
        <div className="drive-public-brand">KOATAG · 分享</div>
        {loading ? (
          <div className="drive-loading">載入中…</div>
        ) : error ? (
          <div className="drive-public-error">
            <div className="drive-public-icon">⚠️</div>
            <div className="drive-public-error-msg">{error}</div>
          </div>
        ) : meta ? (
          <PublicResourceCard meta={meta} token={token!} />
        ) : null}
      </div>
    </div>
  );
};

const PublicResourceCard: React.FC<{ meta: ShareLandingMeta; token: string }> = ({
  meta,
  token,
}) => {
  const isFolder = meta.resource_type === "folder";
  const icon = isFolder ? "📁" : getMimeIconText(meta.resource.mime ?? "");
  const usesLeft =
    meta.max_uses != null ? Math.max(0, meta.max_uses - meta.use_count) : null;
  return (
    <>
      <div className="drive-public-icon">{icon}</div>
      <div className="drive-public-name" title={meta.resource.name}>
        {meta.resource.name}
      </div>
      <div className="drive-public-meta">
        {meta.resource.size_bytes != null && formatBytes(meta.resource.size_bytes)}
        {meta.resource.mime && ` · ${meta.resource.mime}`}
      </div>
      <div className="drive-public-meta">
        {meta.expires_at && (
          <>
            到期：{new Date(meta.expires_at).toLocaleDateString()}
            {" · "}
          </>
        )}
        {usesLeft != null
          ? `剩餘 ${usesLeft} 次`
          : "不限次數"}
      </div>
      {isFolder ? (
        <div className="drive-public-note">資料夾打包下載後續版本支援</div>
      ) : (
        <a
          className="drive-modal-btn drive-modal-btn-primary drive-public-download"
          href={publicDownloadUrl(token)}
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          下載
        </a>
      )}
    </>
  );
};

export default ShareLinkLandingPage;
export { ShareLinkLandingPage };
