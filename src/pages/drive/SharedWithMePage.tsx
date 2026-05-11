import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listIncomingShares, IncomingShare } from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { formatBytes, getMimeIconText } from "components/drive";
import { Icon } from "components/Icon";

/**
 * /main/drive/shared/in — 共享給我（spec §3.5 + v3）
 *
 * incoming list, click → navigate to existing file detail / folder view。
 * B6 ACL middleware (`canReadFile` / `canReadFolder`) 自動允許 share grantee 讀，
 * 不需特殊 share-grantee endpoint（per koatag #312 設計）。
 */
const SharedWithMePage: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<IncomingShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let aborted = false;
    setLoading(true);
    setError(null);
    listIncomingShares()
      .then((list) => {
        if (!aborted) {
          setItems(list);
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
  }, []);

  const open = (item: IncomingShare) => {
    if (item.resource_type === "file") {
      navigate(`/main/drive/file/${item.resource.id}`);
    } else {
      navigate(`/main/drive/folder/${item.resource.id}`);
    }
  };

  return (
    <div className="drive-page">
      <h2 className="drive-page-title">
        <Icon.heart size={18} /> 共享給我
      </h2>
      {loading ? (
        <div className="drive-loading">載入中…</div>
      ) : error ? (
        <div className="drive-error">{error}</div>
      ) : items.length === 0 ? (
        <div className="drive-empty">目前沒有人分享給你</div>
      ) : (
        <table className="drive-list">
          <thead>
            <tr>
              <th aria-label="icon" />
              <th>名稱</th>
              <th>分享者</th>
              <th>權限</th>
              <th>大小</th>
              <th>過期</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} onClick={() => open(it)} style={{ cursor: "pointer" }}>
                <td>
                  {it.resource_type === "folder"
                    ? "📁"
                    : getMimeIconText(it.resource.mime ?? "")}
                </td>
                <td>{it.resource.name}</td>
                <td>{it.granter?.account ?? `#${it.granter_id}`}</td>
                <td>
                  <span
                    className={`drive-share-permission-badge drive-share-permission-${it.permission}`}
                  >
                    {it.permission === "write" ? "可編輯" : "唯讀"}
                  </span>
                </td>
                <td>
                  {it.resource.size_bytes != null ? formatBytes(it.resource.size_bytes) : "—"}
                </td>
                <td>
                  {it.expires_at ? new Date(it.expires_at).toLocaleDateString() : "永久"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default SharedWithMePage;
export { SharedWithMePage };
