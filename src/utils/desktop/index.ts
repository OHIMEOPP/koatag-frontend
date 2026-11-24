import { $message } from 'utils/message/message';

// 在 Tauri 桌面版裡執行時才會有這個全域物件
export const isDesktop = (): boolean => {
  return '__TAURI_INTERNALS__' in window;
};

// 網頁版把圖庫圖片送到桌面版黑板
// 叫起 APP 時瀏覽器會失去焦點，一直沒失去焦點多半是沒裝 APP
export const importToDesktopApp = (imageId: number) => {
  let left = false;
  const onBlur = () => {
    left = true;
  };
  window.addEventListener('blur', onBlur);

  window.location.href = `koatag://import?image=${imageId}`;

  setTimeout(() => {
    window.removeEventListener('blur', onBlur);
    if (!left && document.visibilityState === 'visible') {
      $message('沒有反應的話，請先安裝並開啟過一次 KOATAG 桌面版', 'info');
    }
  }, 2500);
};
