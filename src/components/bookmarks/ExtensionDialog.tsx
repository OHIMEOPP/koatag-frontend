import React from 'react';
import { Icon } from 'components/Icon';
import { useDialogEsc } from 'hooks/useDialogEsc';

type Props = {
  installedVersion: string;
  latestVersion: string;
  outdated: boolean;
  downloading: boolean;
  onDownload: () => void;
  onClose: () => void;
};

// 已裝擴充套件時的安裝與更新說明，下載也在這裡
export const ExtensionDialog: React.FC<Props> = ({
  installedVersion, latestVersion, outdated, downloading, onDownload, onClose,
}) => {
  useDialogEsc(onClose);

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal drive-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">擴充套件安裝</div>

        <div className="bm-dialog-version">
          <span>目前安裝 v{installedVersion}</span>
          {latestVersion && <span>最新版 v{latestVersion}</span>}
          {outdated && <span className="bm-dialog-warn">版本過低，建議更新</span>}
        </div>

        <div className="bm-notice">
          第一次安裝：
          <ol>
            <li>按下方「下載擴充套件」，把 zip 解壓縮</li>
            <li>開啟 <code>chrome://extensions</code>，打開右上角「開發人員模式」</li>
            <li>按「載入未封裝項目」，選解壓縮後的 <code>bookmark-sync</code> 資料夾</li>
            <li>回到這一頁重新整理</li>
          </ol>
        </div>

        <div className="bm-notice">
          更新：
          <ol>
            <li>下載後解壓縮，覆蓋原本的 <code>bookmark-sync</code> 資料夾</li>
            <li>在 <code>chrome://extensions</code> 的 KOATAG 書籤按「重新載入」</li>
            <li>回到這一頁重新整理</li>
          </ol>
        </div>

        <div className="drive-modal-actions">
          <button type="button" className="drive-modal-btn" onClick={onClose}>關閉</button>
          <button type="button" className="drive-modal-btn drive-modal-btn-primary" onClick={onDownload} disabled={downloading}>
            <Icon.download size={13} /> {downloading ? '下載中…' : '下載擴充套件'}
          </button>
        </div>
      </div>
    </div>
  );
};
