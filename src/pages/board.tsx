import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { isDesktop } from 'utils/desktop';
import { BoardCanvas } from 'components/board/BoardCanvas';
import { BoardItem, BoardView } from 'components/board/types';
import { GalleryPicker } from 'components/board/GalleryPicker';
import { BoardContextMenu } from 'components/board/BoardContextMenu';
import { GalleryAiDialog } from 'components/bookmarks/GalleryAiDialog';
import { aiAnotherTags } from 'services/bookmark.service';
import { ImageData } from 'components';
import {
  galleryImageUrl, loadImage, rememberKoatagUrl, toBoardData, fromBoardData, saveLocalBoard, loadLocalBoard,
  imageUrlFromDrop, copyLocalImage, localImageUrl, saveItemToGallery,
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
type BoardProps = {
  // 獨立黑板視窗，沒有側欄與頂端列
  standalone?: boolean;
};

const Board: React.FC<BoardProps> = ({ standalone = false }) => {
  // 視窗 label 決定暫存檔，網頁版用不到
  let label = 'main';
  if (isDesktop()) {
    label = getCurrentWindow().label;
  }

  const [view, setView] = useState<BoardView>(DEFAULT_VIEW);
  const [items, setItems] = useState<BoardItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [showPicker, setShowPicker] = useState(false);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // 等使用者回答要不要 AI 辨識的那張圖
  const [aiAskId, setAiAskId] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  // 讀完本機暫存才開始自動存，避免空黑板蓋掉檔案
  const [loaded, setLoaded] = useState(false);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  // 主視窗的專注模式，藏起側欄與頂端列
  const [focus, setFocus] = useState(false);

  // 用 body 的 class 控制外框，離開黑板頁時一定拿掉
  useEffect(() => {
    if (focus) {
      document.body.classList.add('board-focus');
    } else {
      document.body.classList.remove('board-focus');
    }
    return () => document.body.classList.remove('board-focus');
  }, [focus]);

  // 獨立黑板視窗按關閉先確認，主視窗關閉由 Rust 結束整個 APP
  useEffect(() => {
    if (!isDesktop() || label === 'main') {
      return;
    }
    const unlisten = getCurrentWindow().onCloseRequested((e) => {
      e.preventDefault();
      setShowCloseConfirm(true);
    });
    return () => {
      unlisten.then((off) => off());
    };
  }, [label]);

  const openBoardWindow = () => {
    invoke('open_board_window').catch((e) => {
      $message('開新黑板失敗：' + e, 'error');
    });
  };

  const closeThisWindow = () => {
    invoke('close_board_window', { label: label }).catch((e) => {
      setShowCloseConfirm(false);
      $message('關閉失敗：' + e, 'error');
    });
  };

  // 打開時讀回本機暫存
  useEffect(() => {
    if (!isDesktop()) {
      return;
    }
    loadLocalBoard(label).then((data) => {
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
      saveLocalBoard(label, toBoardData(view, items)).catch((e) => {
        console.error('[board] 本機暫存失敗', e);
      });
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, view, items]);

  // 在圖上按右鍵先選取它再開選單
  const onContextMenu = (id: string, clientX: number, clientY: number) => {
    onSelect(id);
    setMenu({ id: id, x: clientX, y: clientY });
  };

  const closeMenu = useCallback(() => setMenu(null), []);

  const removeItem = (item: BoardItem) => {
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    setSelectedId(null);
  };

  // 存進圖庫，存好後黑板上這張改成記圖庫的 image_id
  const runSaveToGallery = async (item: BoardItem, useAi: boolean) => {
    if (savingIds.has(item.id)) {
      return;
    }
    setSavingIds((prev) => new Set(prev).add(item.id));
    $message('存進圖庫中…');

    let anotherTag: string | null = null;
    let aiFailed = false;
    if (useAi && item.kind === 'url' && item.url) {
      try {
        anotherTag = (await aiAnotherTags(item.url)) || null;
      } catch (e) {
        aiFailed = true;
      }
    }

    try {
      const result = await saveItemToGallery(item, anotherTag);
      setItems((prev) => {
        const next: BoardItem[] = [];
        for (const it of prev) {
          if (it.id === item.id) {
            next.push({
              id: it.id,
              kind: 'koatag',
              image_id: result.imageId,
              x: it.x,
              y: it.y,
              scale: it.scale,
              rotation: it.rotation,
              z: it.z,
            });
          } else {
            next.push(it);
          }
        }
        return next;
      });
      if (result.status === 'exists') {
        $message('這張圖本來就在圖庫，已改成圖庫圖片', 'info');
      } else if (aiFailed) {
        $message('已存進圖庫，但 AI 辨識失敗，沒有填其他標籤', 'warning');
      } else {
        $message('已存進圖庫');
      }
    } catch (e: any) {
      console.error('[board] 存進圖庫失敗', e);
      $message('存進圖庫失敗：' + (e?.message || e), 'error');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  // 網頁圖先問要不要 AI 辨識，電腦檔案直接存
  const saveToGallery = (item: BoardItem) => {
    if (item.kind === 'url') {
      setAiAskId(item.id);
      return;
    }
    runSaveToGallery(item, false);
  };

  // 專注模式按 Esc 離開，有視窗或選單開著時 Esc 先關它們
  useEffect(() => {
    if (!focus) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showPicker && !menu && !aiAskId && !showCloseConfirm) {
        setFocus(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focus, showPicker, menu, aiAskId, showCloseConfirm]);

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
      $message(`${failed} 張圖載入失敗`, 'warning');
    }
  };

  // 電腦檔案複製到 APP 資料夾再放上黑板，多張往右下錯開
  const dropLocalFiles = async (files: File[], point: { x: number; y: number }) => {
    let maxZ = 0;
    for (const it of items) {
      if (it.z > maxZ) {
        maxZ = it.z;
      }
    }

    const added: BoardItem[] = [];
    let skipped = 0;
    for (const file of files) {
      let name = null;
      try {
        name = await copyLocalImage(file);
      } catch (e) {
        console.error('[board] 複製電腦檔案失敗', e);
      }
      if (!name) {
        skipped++;
        continue;
      }
      const src = await localImageUrl(name);
      let img = null;
      if (src) {
        img = await loadImage(src);
      }
      if (!img) {
        skipped++;
        continue;
      }
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      const offset = added.length * NEW_IMAGE_OFFSET / view.zoom;
      added.push({
        id: crypto.randomUUID(),
        kind: 'file',
        path: name,
        x: point.x + offset,
        y: point.y + offset,
        scale: NEW_IMAGE_SIZE / view.zoom / longest,
        rotation: 0,
        z: maxZ + 1 + added.length,
      });
    }

    if (added.length > 0) {
      setItems((prev) => [...prev, ...added]);
    }
    if (skipped > 0) {
      $message(`不是支援的圖片格式`, 'warning');
    }
  };

  // 拖進來的東西：瀏覽器的圖記網址，電腦檔案存複本
  const onDrop = async (data: DataTransfer, point: { x: number; y: number }) => {
    const url = imageUrlFromDrop(data);
    if (!url) {
      if (data.files.length > 0) {
        await dropLocalFiles(Array.from(data.files), point);
      } else {
        $message('沒有找到圖片網址', 'warning');
      }
      return;
    }

    const img = await loadImage(url);
    if (!img) {
      $message('無法載入，可能網站不允許外部讀取', 'warning');
      return;
    }

    let maxZ = 0;
    for (const it of items) {
      if (it.z > maxZ) {
        maxZ = it.z;
      }
    }

    const longest = Math.max(img.naturalWidth, img.naturalHeight);
    const item: BoardItem = {
      id: crypto.randomUUID(),
      kind: 'url',
      url: url,
      x: point.x,
      y: point.y,
      scale: NEW_IMAGE_SIZE / view.zoom / longest,
      rotation: 0,
      z: maxZ + 1,
    };
    setItems((prev) => [...prev, item]);
  };

  let aiAskItem: BoardItem | null = null;
  if (aiAskId) {
    for (const it of items) {
      if (it.id === aiAskId) {
        aiAskItem = it;
      }
    }
  }

  // 選單對應的圖，圖被刪掉選單就不顯示
  let menuItem: BoardItem | null = null;
  if (menu) {
    for (const it of items) {
      if (it.id === menu.id) {
        menuItem = it;
      }
    }
  }

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
    <div className={`board-page ${standalone ? 'standalone' : ''}`}>
      <div className="board-toolbar">
        <span className="board-title">黑板</span>
        <span className="board-zoom">{Math.round(view.zoom * 100)}%</span>
        <button type="button" className="board-btn" onClick={() => setView(DEFAULT_VIEW)}>
          回到原點
        </button>
        <button type="button" className="board-btn board-btn-primary" onClick={() => setShowPicker(true)}>
          從圖庫加入
        </button>
        <button type="button" className="board-btn" onClick={openBoardWindow}>
          開新黑板
        </button>
        {!standalone && (
          <button type="button" className="board-btn" onClick={() => setFocus(!focus)}>
            {focus ? '離開專注模式' : '專注模式'}
          </button>
        )}
        <span className="board-hint">可從瀏覽器或電腦拖圖進來；點圖片選取，拖角落縮放、拖上方圓點旋轉，Delete 從黑板移除</span>
      </div>
      <BoardCanvas
        view={view}
        items={items}
        selectedId={selectedId}
        onViewChange={setView}
        onSelect={onSelect}
        onItemChange={onItemChange}
        onSizeChange={setCanvasSize}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
      />
      {showPicker && <GalleryPicker onPick={onPick} onClose={() => setShowPicker(false)} />}
      {menuItem && (
        <BoardContextMenu
          item={menuItem}
          x={menu ? menu.x : 0}
          y={menu ? menu.y : 0}
          onSaveToGallery={saveToGallery}
          onRemove={removeItem}
          onClose={closeMenu}
        />
      )}
      {showCloseConfirm && (
        <div className="drive-modal-overlay" onClick={() => setShowCloseConfirm(false)}>
          <div className="drive-modal" onClick={(e) => e.stopPropagation()} role="dialog">
            <div className="drive-modal-title">關閉這塊黑板？</div>
            <div className="bm-notice">關閉後這塊黑板的內容會清掉，下次開 APP 也不會還原。</div>
            <div className="drive-modal-actions">
              <button type="button" className="drive-modal-btn" onClick={() => setShowCloseConfirm(false)}>取消</button>
              <button type="button" className="drive-modal-btn drive-modal-btn-primary" onClick={closeThisWindow}>
                關閉並清掉
              </button>
            </div>
          </div>
        </div>
      )}
      {aiAskItem && (
        <GalleryAiDialog
          count={1}
          hideArtistNote
          onPick={(useAi) => {
            const target = aiAskItem as BoardItem;
            setAiAskId(null);
            runSaveToGallery(target, useAi);
          }}
          onClose={() => setAiAskId(null)}
        />
      )}
    </div>
  );
};

export { Board };
