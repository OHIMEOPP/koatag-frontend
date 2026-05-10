import { useEffect } from "react";

/**
 * 共用 ESC keydown 監聽 — drive ContextMenu / RenameDialog / MoveDialog /
 * ConfirmDialog 等彈層都要 ESC 關閉。
 *
 * 抽出來避免每個 dialog 各自 useEffect + addEventListener + cleanup return
 * 三段樣板程式碼。
 */
export function useDialogEsc(onClose: () => void): void {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [onClose]);
}
