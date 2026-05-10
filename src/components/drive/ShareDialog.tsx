import React, { useEffect, useRef, useState } from "react";
import {
  createShare,
  createShareLink,
} from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { useDialogEsc } from "hooks/useDialogEsc";

type Tab = "acl" | "link";

interface ShareDialogProps {
  resourceType: "file" | "folder";
  resourceId: number;
  resourceName: string;
  onClose: () => void;
}

/**
 * 分享 dialog（spec §3.5 + v3）— 兩 tab：
 * - ACL grant：input grantee_id（numeric） + permission（MVP read） + expires_at
 *   → POST /drive/shares
 * - Public link：permission + expires_at + max_uses → POST /drive/share-links
 *   成功後顯示 token URL + copy 按鈕。folder 部分 download 後端 422（spec §11
 *   v? zip-on-fly future），landing page UI 自己擋。
 *
 * MVP 用 numeric grantee_id input — 沒 user search endpoint，user 自備 ID。
 * v3+ 升級成 user search/autocomplete。
 */
export const ShareDialog: React.FC<ShareDialogProps> = ({
  resourceType,
  resourceId,
  resourceName,
  onClose,
}) => {
  const [tab, setTab] = useState<Tab>("acl");
  useDialogEsc(onClose);

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div
        className="drive-modal drive-modal-wide"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
      >
        <div className="drive-modal-title">分享「{resourceName}」</div>
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
            建立公開連結
          </button>
        </div>
        {tab === "acl" ? (
          <AclForm
            resourceType={resourceType}
            resourceId={resourceId}
            onClose={onClose}
          />
        ) : (
          <LinkForm
            resourceType={resourceType}
            resourceId={resourceId}
          />
        )}
        <div className="drive-modal-actions">
          <button type="button" className="drive-modal-btn" onClick={onClose}>
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

const AclForm: React.FC<{
  resourceType: "file" | "folder";
  resourceId: number;
  onClose: () => void;
}> = ({ resourceType, resourceId, onClose }) => {
  const [granteeId, setGranteeId] = useState("");
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // unmount 清 setTimeout 防 dialog 已 close 還 fire onClose 觸發 setState warning
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const submit = async () => {
    const id = Number(granteeId);
    if (!Number.isFinite(id) || id <= 0) {
      setErr("請輸入有效的使用者 ID（正整數）");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      await createShare({
        resourceType,
        resourceId,
        granteeId: id,
        permission,
        expiresAt: expiresAt || undefined,
      });
      setOk(true);
      // 1.2s 後 auto close（unmount cleanup 防 race）
      closeTimerRef.current = setTimeout(() => onClose(), 1200);
    } catch (e) {
      setErr(mapDriveError(e));
      setSubmitting(false);
    }
  };

  if (ok) {
    return <div className="drive-modal-success">✓ 已分享</div>;
  }

  return (
    <div className="drive-share-form">
      <label className="drive-share-field">
        <span>使用者 ID</span>
        <input
          type="number"
          className="drive-modal-input"
          value={granteeId}
          onChange={(e) => setGranteeId(e.target.value)}
          placeholder="例如 38"
          disabled={submitting}
        />
      </label>
      <label className="drive-share-field">
        <span>權限</span>
        <select
          className="drive-modal-input"
          value={permission}
          onChange={(e) => setPermission(e.target.value as "read" | "write")}
          disabled={submitting}
        >
          <option value="read">唯讀</option>
          <option value="write" disabled title="後端尚未支援，敬請期待">
            編輯（規劃中）
          </option>
        </select>
      </label>
      <label className="drive-share-field">
        <span>過期時間（選填）</span>
        <input
          type="datetime-local"
          className="drive-modal-input"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          disabled={submitting}
        />
      </label>
      {err && <div className="drive-modal-error">{err}</div>}
      <div className="drive-share-submit-row">
        <button
          type="button"
          className="drive-modal-btn drive-modal-btn-primary"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "分享中…" : "分享"}
        </button>
      </div>
    </div>
  );
};

const LinkForm: React.FC<{
  resourceType: "file" | "folder";
  resourceId: number;
}> = ({ resourceType, resourceId }) => {
  const [permission, setPermission] = useState<"read" | "write">("read");
  const [expiresAt, setExpiresAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<{ token: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    setSubmitting(true);
    setErr(null);
    try {
      const muNum = maxUses ? Number(maxUses) : undefined;
      const link = await createShareLink({
        resourceType,
        resourceId,
        permission,
        expiresAt: expiresAt || undefined,
        maxUses: muNum && Number.isFinite(muNum) && muNum > 0 ? muNum : undefined,
      });
      setCreated(link);
    } catch (e) {
      setErr(mapDriveError(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (created) {
    const url = `${window.location.origin}/main/drive/share/${created.token}`;
    return (
      <div className="drive-share-form">
        <div className="drive-share-link-row">
          <input
            type="text"
            readOnly
            className="drive-modal-input"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            type="button"
            className="drive-modal-btn"
            onClick={async () => {
              await navigator.clipboard.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? "✓ 已複製" : "複製"}
          </button>
        </div>
        <div className="drive-share-note">
          {resourceType === "folder"
            ? "資料夾分享連結：對方可看見資料夾名稱，但下載功能待 zip-on-fly 後續版本"
            : "對方無需登入即可預覽下載"}
        </div>
      </div>
    );
  }

  return (
    <div className="drive-share-form">
      <label className="drive-share-field">
        <span>權限</span>
        <select
          className="drive-modal-input"
          value={permission}
          onChange={(e) => setPermission(e.target.value as "read" | "write")}
          disabled={submitting}
        >
          <option value="read">唯讀</option>
          <option value="write" disabled title="後端尚未支援，敬請期待">
            編輯（規劃中）
          </option>
        </select>
      </label>
      <label className="drive-share-field">
        <span>過期時間（選填）</span>
        <input
          type="datetime-local"
          className="drive-modal-input"
          value={expiresAt}
          onChange={(e) => setExpiresAt(e.target.value)}
          disabled={submitting}
        />
      </label>
      <label className="drive-share-field">
        <span>最大使用次數（選填）</span>
        <input
          type="number"
          min={1}
          className="drive-modal-input"
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
          placeholder="不限"
          disabled={submitting}
        />
      </label>
      {err && <div className="drive-modal-error">{err}</div>}
      <div className="drive-share-submit-row">
        <button
          type="button"
          className="drive-modal-btn drive-modal-btn-primary"
          onClick={submit}
          disabled={submitting}
        >
          {submitting ? "建立中…" : "建立連結"}
        </button>
      </div>
    </div>
  );
};

