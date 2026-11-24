import React, { useEffect, useRef, useState } from 'react';
import { BoardItem } from './types';

type Props = {
  item: BoardItem;
  x: number;
  y: number;
  onSaveToGallery: (item: BoardItem) => void;
  onRemove: (item: BoardItem) => void;
  onCopy: (item: BoardItem) => void;
  onCut: (item: BoardItem) => void;
  onClose: () => void;
};

// 圖片右鍵選單，點外面、按 Esc、捲動都會關
export const BoardContextMenu: React.FC<Props> = ({ item, x, y, onSaveToGallery, onRemove, onCopy, onCut, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // 靠近視窗邊緣時往內縮，選單不超出畫面
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      return;
    }
    let left = x;
    let top = y;
    if (left + menu.offsetWidth > window.innerWidth - 8) {
      left = window.innerWidth - menu.offsetWidth - 8;
    }
    if (top + menu.offsetHeight > window.innerHeight - 8) {
      top = window.innerHeight - menu.offsetHeight - 8;
    }
    setPos({ left: left, top: top });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onClose);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', onClose);
    };
  }, [onClose]);

  const inGallery = item.kind === 'koatag';

  return (
    <div
      ref={menuRef}
      className="board-menu"
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <button
        type="button"
        className="board-menu-item"
        disabled={inGallery}
        onClick={() => {
          onClose();
          onSaveToGallery(item);
        }}
      >
        {inGallery ? '已在圖庫' : '存進圖庫'}
      </button>
      <button
        type="button"
        className="board-menu-item"
        onClick={() => {
          onClose();
          onCopy(item);
        }}
      >
        複製<span className="board-menu-key">Ctrl+C</span>
      </button>
      <button
        type="button"
        className="board-menu-item"
        onClick={() => {
          onClose();
          onCut(item);
        }}
      >
        剪下<span className="board-menu-key">Ctrl+X</span>
      </button>
      <button
        type="button"
        className="board-menu-item danger"
        onClick={() => {
          onClose();
          onRemove(item);
        }}
      >
        從黑板移除
      </button>
    </div>
  );
};
