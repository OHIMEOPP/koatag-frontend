// 在 Tauri 桌面版裡執行時才會有這個全域物件
export const isDesktop = (): boolean => {
  return '__TAURI_INTERNALS__' in window;
};
