import React, { useState } from "react";
import { useMasterKey } from "contexts/MasterKeyContext";
import { loginFlow, logout, LoginError } from "services/auth.service";

/**
 * R2 #4 cutover — force-re-login gate（enforce-safety §2.2.1）.
 *
 * Route-level guard wrapping the Drive subtree (mounted at the DrivePage
 * boundary, per D1 ratify). It catches the "refresh-window" hole: the three
 * E2EE secrets live in-memory only (MasterKeyContext L3-18) and reset to null on
 * any full page load, while the JWT survives in localStorage. In that window
 * every encrypted write (upload / folder create+rename) and every decrypt
 * (listing / breadcrumb / download) has no masterPubkey to wrap/unwrap with.
 *
 * Trigger = token present (logged in) && masterPubkey == null (keys washed).
 * A logged-out user has no token and takes the normal /login flow — not this gate.
 *
 * Affordance = inline re-derive modal (NOT redirect /login — that would infinite
 * loop, because login.tsx full-reloads and re-washes the keys; see the cutover
 * BLOCKER raise). The token is still valid, so we only need to re-derive the
 * in-memory keys from the password: loginFlow re-runs the KDF and calls setKeys,
 * the Context updates, masterPubkey becomes non-null, and the gate releases with
 * zero reload. This is MasterKeyContext L16-18's "force re-login flow" intent.
 */
function getCurrentAccount(): string {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return "";
    const u = JSON.parse(raw);
    return u.account || u.email || "";
  } catch {
    return "";
  }
}

export const RequireKeys: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { masterPubkey, setKeys } = useMasterKey();
  const token = localStorage.getItem("token");

  // Keys present (or genuinely logged out) → render the Drive subtree as normal.
  if (masterPubkey || !token) return <>{children}</>;

  return <ReloginGate onKeys={setKeys} />;
};

const ReloginGate: React.FC<{ onKeys: ReturnType<typeof useMasterKey>["setKeys"] }> = ({
  onKeys,
}) => {
  const [account] = useState(getCurrentAccount);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!account) {
      setErr("找不到帳號資訊，請改用登出後重新登入");
      return;
    }
    if (!password) {
      setErr("請輸入密碼");
      return;
    }
    setSubmitting(true);
    setErr(null);
    try {
      // Re-derive the in-memory key bundle from the password. onKeys (Context
      // setKeys) re-populates masterPubkey → RequireKeys re-renders → gate
      // releases. No reload, no navigation.
      await loginFlow({ account, password, onKeys });
    } catch (e) {
      setErr(e instanceof LoginError ? e.message : "重新登入失敗，請稍後再試");
      setSubmitting(false);
    }
  };

  const giveUp = async () => {
    // Escape hatch (forgot password / wrong account): full logout → fresh /login.
    await logout();
    window.location.href = "/login";
  };

  return (
    <div className="drive-relogin-gate" role="dialog" aria-modal="true">
      <div className="drive-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drive-modal-title">需要重新登入</div>
        <p className="drive-relogin-hint">
          您的工作階段金鑰已失效（重新整理頁面後金鑰不會保留）。
          請輸入密碼以繼續存取雲端硬碟，您的檔案不會受影響。
        </p>
        {account && <div className="drive-relogin-account">帳號：{account}</div>}
        <input
          type="password"
          className="drive-modal-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          placeholder="輸入密碼"
          autoComplete="current-password"
          autoFocus
          disabled={submitting}
        />
        {err && <div className="drive-modal-error">{err}</div>}
        <div className="drive-modal-actions">
          <button
            type="button"
            className="drive-modal-btn"
            onClick={giveUp}
            disabled={submitting}
          >
            登出
          </button>
          <button
            type="button"
            className="drive-modal-btn drive-modal-btn-primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "登入中…" : "重新登入"}
          </button>
        </div>
      </div>
    </div>
  );
};
