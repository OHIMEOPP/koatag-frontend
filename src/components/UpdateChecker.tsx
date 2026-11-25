import React, { useEffect, useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ConfirmDialog } from 'components/drive';
import { isDesktop } from 'utils/desktop';

// 桌面版正式版開啟時檢查一次更新，有新版問要不要裝
// 開發版不檢查，不然會跳出正式版的更新
export const UpdateChecker: React.FC = () => {
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    if (!isDesktop() || process.env.NODE_ENV !== 'production') {
      return;
    }
    // 只有主視窗檢查，黑板視窗不重複問
    if (getCurrentWindow().label !== 'main') {
      return;
    }
    check()
      .then((found) => {
        if (found) {
          setUpdate(found);
        }
      })
      .catch((e) => {
        // 連不到更新網址就算了，下次開啟再檢查
        console.error('[updater] 檢查更新失敗', e);
      });
  }, []);

  if (!update) {
    return null;
  }

  // 下載安裝完重啟，失敗時丟錯讓確認框顯示
  const install = async () => {
    try {
      await update.downloadAndInstall();
    } catch (e) {
      throw new Error('更新失敗，稍後再試');
    }
    await relaunch();
  };

  let message = `目前是 ${update.currentVersion}，要更新到 ${update.version} 嗎？更新時 APP 會關閉並重新開啟。`;
  if (update.body) {
    message += `\n\n更新內容：\n${update.body}`;
  }

  return (
    <ConfirmDialog
      title="有新版本"
      message={message}
      confirmLabel="立即更新"
      cancelLabel="稍後"
      onConfirm={install}
      onClose={() => setUpdate(null)}
    />
  );
};
