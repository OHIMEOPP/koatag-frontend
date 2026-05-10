import React, { useEffect, useState } from "react";
import {
  listOutgoingShares,
  listMyShareLinks,
  revokeShare,
  revokeShareLink,
  OutgoingShare,
  MyShareLink,
} from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { formatBytes, getMimeIconText, ConfirmDialog } from "components/drive";
import { Icon } from "components/Icon";

type Tab = "acl" | "link";

/**
 * /main/drive/shared/out — 我的分享（v3）
 *
 * 兩 tab：
 * - ACL grants (drive_shares) — `listOutgoingShares` + `revokeShare`
 * - Public links (drive_share_links) — `listMyShareLinks` + `revokeShareLink`
 */
const MySharesPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("acl");
  return (
    <div className="drive-page">
      <h2 className="drive-page-title">
        <Icon.link size={18} /> 我的分享
      </h2>
      <div className="drive-share-tabs">
        <button
          type="button"
          className={`drive-share-tab ${tab === "acl" ? "active" : ""}`}
          onClick={() => setTab("acl")}
        >
          邀請特定使用者
        </button>
        <button
          type="button"
          className={`drive-share-tab ${tab === "link" ? "active" : ""}`}
          onClick={() => setTab("link")}
        >
          公開連結
        </button>
      </div>
      {tab === "acl" ? <AclList /> : <LinkList />}
    </div>
  );
};

const AclList: React.FC = () => {
  const [items, setItems] = useState<OutgoingShare[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<OutgoingShare | null>(null);

  const load = () => {
    setError(null);
    listOutgoingShares()
      .then(setItems)
      .catch((e) => setError(mapDriveError(e)));
  };

  useEffect(load, []);

  if (error) return <div className="drive-error">{error}</div>;
  if (items == null) return <div className="drive-loading">載入中…</div>;
  if (items.length === 0) return <div className="drive-empty">沒有任何分享</div>;

  return (
    <>
      <table className="drive-list">
        <thead>
          <tr>
            <th aria-label="icon" />
            <th>名稱</th>
            <th>分享給</th>
            <th>權限</th>
            <th>過期</th>
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>
                {it.resource_type === "folder"
                  ? "📁"
                  : getMimeIconText(it.resource.mime ?? "")}
              </td>
              <td>{it.resource.name}</td>
              <td>{it.grantee?.account ?? `#${it.grantee_id}`}</td>
              <td>{it.permission === "write" ? "可編輯" : "唯讀"}</td>
              <td>
                {it.expires_at ? new Date(it.expires_at).toLocaleDateString() : "永久"}
              </td>
              <td>
                <button
                  type="button"
                  className="drive-modal-btn"
                  onClick={() => setPending(it)}
                >
                  撤銷
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {pending && (
        <ConfirmDialog
          title="撤銷分享"
          message={`確定撤銷對「${pending.grantee?.account ?? `#${pending.grantee_id}`}」的「${pending.resource.name}」分享？`}
          confirmLabel="撤銷"
          destructive
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await revokeShare(pending.id);
            load();
          }}
        />
      )}
    </>
  );
};

const LinkList: React.FC = () => {
  const [items, setItems] = useState<MyShareLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<MyShareLink | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const load = () => {
    setError(null);
    listMyShareLinks()
      .then(setItems)
      .catch((e) => setError(mapDriveError(e)));
  };

  useEffect(load, []);

  const copy = async (token: string) => {
    const url = `${window.location.origin}/main/drive/share/${token}`;
    await navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  if (error) return <div className="drive-error">{error}</div>;
  if (items == null) return <div className="drive-loading">載入中…</div>;
  if (items.length === 0) return <div className="drive-empty">沒有任何公開連結</div>;

  return (
    <>
      <table className="drive-list">
        <thead>
          <tr>
            <th aria-label="icon" />
            <th>名稱</th>
            <th>使用次數</th>
            <th>過期</th>
            <th>狀態</th>
            <th aria-label="actions" />
          </tr>
        </thead>
        <tbody>
          {items.map((it) => {
            const revoked = it.revoked_at != null;
            return (
              <tr key={it.id} className={revoked ? "drive-share-row-revoked" : ""}>
                <td>
                  {it.resource_type === "folder"
                    ? "📁"
                    : getMimeIconText(it.resource.mime ?? "")}
                </td>
                <td>{it.resource.name}</td>
                <td>
                  {it.use_count}
                  {it.max_uses != null ? ` / ${it.max_uses}` : ""}
                </td>
                <td>
                  {it.expires_at ? new Date(it.expires_at).toLocaleDateString() : "永久"}
                </td>
                <td>{revoked ? "已撤銷" : "有效"}</td>
                <td>
                  {!revoked && (
                    <>
                      <button
                        type="button"
                        className="drive-modal-btn"
                        onClick={() => copy(it.token)}
                      >
                        {copiedToken === it.token ? "✓ 已複製" : "複製連結"}
                      </button>
                      <button
                        type="button"
                        className="drive-modal-btn"
                        onClick={() => setPending(it)}
                        style={{ marginLeft: 6 }}
                      >
                        撤銷
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {pending && (
        <ConfirmDialog
          title="撤銷分享連結"
          message={`確定撤銷「${pending.resource.name}」的公開連結？已使用 ${pending.use_count} 次。`}
          confirmLabel="撤銷"
          destructive
          onClose={() => setPending(null)}
          onConfirm={async () => {
            await revokeShareLink(pending.id);
            load();
          }}
        />
      )}
    </>
  );
};

export default MySharesPage;
export { MySharesPage };
