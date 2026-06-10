import React from "react";
import { Icon } from "components/Icon";
import { useDisclosureStore } from "stores/disclosureStore";

// R3 #7 §2.2.5 — E2EE upload trust disclosure (USER LOCKED §3 #6).
//
// Two affordances communicating the encrypted-era trust boundary (§2.3.4):
//   1. A persistent info icon (shield) with a hover tooltip, always shown next
//      to the upload area.
//   2. A one-time dismissable banner shown until the user acknowledges it
//      (persisted via disclosureStore / localStorage).
//
// The server cannot see encrypted content, so client-side magic-byte checks are
// the only type gate — this UI makes that trust boundary explicit rather than
// implying the server validated the file (it cannot).

const TOOLTIP_TEXT =
  "上傳檔案類型由本機檢查；伺服器看不到加密內容，無法驗證類型。請只上傳信任的檔案。";

const BANNER_TEXT =
  "您的 Drive 採用端到端加密 — 伺服器看不到檔案內容／類型；上傳安全由您本機把關。";

export const UploadTrustDisclosure: React.FC = () => {
  const bannerDismissed = useDisclosureStore((s) => s.bannerDismissed);
  const dismissBanner = useDisclosureStore((s) => s.dismissBanner);

  return (
    <div className="drive-trust-disclosure" data-testid="upload-trust-disclosure">
      <div className="drive-trust-disclosure-head">
        <span
          className="drive-trust-disclosure-info"
          data-tooltip-id="tooltip"
          data-tooltip-content={TOOLTIP_TEXT}
          aria-label={TOOLTIP_TEXT}
          role="img"
          tabIndex={0}
        >
          <Icon.shield size={15} />
          <span className="drive-trust-disclosure-info-label">端到端加密</span>
        </span>
      </div>
      {!bannerDismissed && (
        <div className="drive-trust-disclosure-banner" role="status">
          <Icon.lock size={15} className="drive-trust-disclosure-banner-icon" />
          <span className="drive-trust-disclosure-banner-text">{BANNER_TEXT}</span>
          <button
            type="button"
            className="drive-trust-disclosure-dismiss"
            onClick={dismissBanner}
            aria-label="我知道了，關閉提示"
          >
            <Icon.x size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
