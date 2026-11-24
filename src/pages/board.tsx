import React, { useEffect, useState } from 'react';
import { isDesktop } from 'utils/desktop';
import { BoardCanvas } from 'components/board/BoardCanvas';
import { BoardItem, BoardView } from 'components/board/types';
import { GalleryPicker } from 'components/board/GalleryPicker';
import { ImageData } from 'components';
import {
  galleryImageUrl, loadImage, rememberKoatagUrl, toBoardData, fromBoardData, saveLocalBoard, loadLocalBoard,
} from 'services/board.service';
import { $message } from 'utils';

const DEFAULT_VIEW: BoardView = { x: 0, y: 0, zoom: 1 };
// 新加的圖長邊在畫面上約多大
const NEW_IMAGE_SIZE = 300;
// 一次加多張時每張錯開的距離
const NEW_IMAGE_OFFSET = 30;
// 停止變動多久後寫入本機暫存
const SAVE_DELAY = 1000;

// 黑板頁，只在桌面版使用
const Board: React.FC = () => {
  const [view, setView] = useState<BoardView>(DEFAULT_VIEW);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showPicker, setShowPicker] = useState(false);
  // 讀完本機暫存才開始自動存，避免空黑板蓋掉檔案
  const [loaded, setLoaded] = useState(false);

  // 打開時讀回本機暫存
  useEffect(() => {
    if (!isDesktop()) {
      return;
    }
    loadLocalBoard().then((data) => {
      if (data) {
        const board = fromBoardData(data);
        setView(board.view);
        setItems(board.items);
      }
      setLoaded(true);
    });
  }, []);

  // 黑板變動後停 1 秒才寫檔，拖曳中不會一直寫
  useEffect(() => {
    if (!loaded) {
      return;
    }
    const timer = setTimeout(() => {
      saveLocalBoard(toBoardData(view, items)).catch((e) => {
        console.error('[board] 本機暫存失敗', e);
      });
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [loaded, view, items]);

  // 選取的圖按 Delete 從黑板拿掉，打字中不算
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' || !selectedId) {
        return;
      }
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') {
        return;
      }
      setItems((prev) => prev.filter((it) => it.id !== selectedId));
      setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedId]);

  // 點到的圖移到最上層
  const onSelect = (id: string | null) => {
    setSelectedId(id);
    if (id === null) {
      return;
    }
    setItems((prev) => {
      let maxZ = 0;
      for (const it of prev) {
        if (it.z > maxZ) {
          maxZ = it.z;
        }
      }
      const next: BoardItem[] = [];
      for (const it of prev) {
        if (it.id === id && it.z !== maxZ) {
          next.push({ ...it, z: maxZ + 1 });
        } else {
          next.push(it);
        }
      }
      return next;
    });
  };

  const onItemChange = (item: BoardItem) => {
    setItems((prev) => {
      const next: BoardItem[] = [];
      for (const it of prev) {
        if (it.id === item.id) {
          next.push(item);
        } else {
          next.push(it);
        }
      }
      return next;
    });
  };

  // 選好的圖放到目前畫面中央，多張時往右下錯開
  const onPick = async (images: ImageData[]) => {
    setShowPicker(false);

    const centerX = (canvasSize.width / 2 - view.x) / view.zoom;
    const centerY = (canvasSize.height / 2 - view.y) / view.zoom;

    let maxZ = 0;
    for (const it of items) {
      if (it.z > maxZ) {
        maxZ = it.z;
      }
    }

    // 全部同時載入，拿原圖尺寸換算成畫面上差不多大
    const urls: string[] = [];
    const loading: Array<Promise<HTMLImageElement | null>> = [];
    for (const image of images) {
      const url = galleryImageUrl(image);
      urls.push(url);
      loading.push(loadImage(url));
    }
    const loaded = await Promise.all(loading);

    const added: BoardItem[] = [];
    let failed = 0;
    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      const img = loaded[i];
      if (!img || !image.id) {
        failed++;
        continue;
      }
      rememberKoatagUrl(image.id, urls[i]);
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      const offset = added.length * NEW_IMAGE_OFFSET / view.zoom;
      added.push({
        id: crypto.randomUUID(),
        kind: 'koatag',
        image_id: image.id,
        x: centerX + offset,
        y: centerY + offset,
        scale: NEW_IMAGE_SIZE / view.zoom / longest,
        rotation: 0,
        z: maxZ + 1 + added.length,
      });
    }

    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
    }
    if (failed > 0) {
      $message(`${failed} 張圖載入失敗，沒有加上黑板`, 'warning');
    }
  };

  if (!isDesktop()) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="t-h1 page-title">黑板</h1>
            <p className="page-sub">黑板只能在 KOATAG 桌面版使用</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="board-page">
      <div className="board-toolbar">
        <span className="board-title">黑板</span>
        <span className="board-zoom">{Math.round(view.zoom * 100)}%</span>
        <button type="button" className="board-btn" onClick={() => setView(DEFAULT_VIEW)}>
          回到原點
        </button>
        <button type="button" className="board-btn board-btn-primary" onClick={() => setShowPicker(true)}>
          從圖庫加入
        </button>
        <span className="board-hint">點圖片選取，拖角落縮放、拖上方圓點旋轉，Delete 從黑板移除</span>
      </div>
      <BoardCanvas
        view={view}
        items={items}
        selectedId={selectedId}
        onViewChange={setView}
        onSelect={onSelect}
        onItemChange={onItemChange}
        onSizeChange={setCanvasSize}
      />
      {showPicker && <GalleryPicker onPick={onPick} onClose={() => setShowPicker(false)} />}
    </div>
  );
};

export { Board };
