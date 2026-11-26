import { $message } from 'utils/message/message';

// 在 Tauri 桌面版裡執行時才會有這個全域物件
export const isDesktop = (): boolean => {
  return '__TAURI_INTERNALS__' in window;
};

// 跟 tauri.conf.json 的更新網址同一份
const LATEST_JSON_URL =
  'https://objectstorage.ap-tokyo-1.oraclecloud.com/p/pknv_KjVgp42emaOZLhM5a3tjskZduS2wl6cncX_CiZqFV7OYMrDDvHqmom7I3qQ/n/nr27tf8xagsn/b/koatag-desktop/o/latest.json';

// 讀最新版資訊再下載安裝檔 發新版不用改這裡
export const downloadDesktopApp = async () => {
  try {
    const res = await fetch(LATEST_JSON_URL, { cache: 'no-store' });
    const data = await res.json();
    const url = data.platforms['windows-x86_64'].url;
    window.location.href = url;
  } catch (e) {
    $message('取得下載網址失敗，稍後再試', 'error');
  }
};

// 網頁版把圖庫圖片送到桌面版黑板
// 叫起 APP 時瀏覽器會失去焦點，一直沒失去焦點多半是沒裝 APP
export const importToDesktopApp = (imageId: number) => {
  let left = false;
  const onBlur = () => {
    left = true;
  };
  window.addEventListener('blur', onBlur);

  // 開發環境設成 koatag-dev，才會叫起開發版 APP
  const scheme = process.env.REACT_APP_DESKTOP_SCHEME || 'koatag';
  window.location.href = `${scheme}://import?image=${imageId}`;

  setTimeout(() => {
    window.removeEventListener('blur', onBlur);
    if (!left && document.visibilityState === 'visible') {
      $message('請先至左側下方下載並開啟 KOATAG 桌面版', 'info');
    }
  }, 2500);
};
