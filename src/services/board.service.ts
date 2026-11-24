import api from 'api/axios';
import { BaseDirectory, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { ImageData } from 'components';
import { BoardItem, BoardView } from 'components/board/types';
import { getFilePath } from 'utils';

type FindOneResponse = { status: number; result: ImageData | null };

// image_id 對應的原圖網址，同一張只查一次
const koatagUrlCache = new Map<number, Promise<string | null>>();

// 圖庫的一筆資料轉成原圖網址，外連圖直接用原網址
export const galleryImageUrl = (image: ImageData): string => {
  if (image.check_img_type === 'HTTP') {
    return image.img_path;
  }
  return getFilePath(String(image.user_id), image.img_path);
};

// 圖庫的一筆資料轉成縮圖網址，沒有縮圖用原圖
export const galleryThumbUrl = (image: ImageData): string => {
  if (image.thumb_path) {
    return getFilePath(String(image.user_id), image.thumb_path);
  }
  return galleryImageUrl(image);
};

// 用 image_id 查原圖網址，查不到或不是自己的圖回 null
export const koatagImageUrl = (imageId: number): Promise<string | null> => {
  const cached = koatagUrlCache.get(imageId);
  if (cached) {
    return cached;
  }
  const request = api
    .get<FindOneResponse>(`/image/findOneImg/id/${imageId}`)
    .then((response) => {
      const image = response.data.result;
      if (!image) {
        return null;
      }
      return galleryImageUrl(image);
    })
    .catch(() => {
      // 失敗的不留在快取，下次再試
      koatagUrlCache.delete(imageId);
      return null;
    });
  koatagUrlCache.set(imageId, request);
  return request;
};

// 已經知道網址的圖先記進快取，放上黑板時不用再查
export const rememberKoatagUrl = (imageId: number, url: string) => {
  koatagUrlCache.set(imageId, Promise.resolve(url));
};

// 先載入圖片拿到原始尺寸，載不到回 null
export const loadImage = (src: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
};

// 存檔格式，本機暫存與雲端存檔共用
export type BoardData = {
  version: number;
  view: BoardView;
  items: Array<Omit<BoardItem, 'id'>>;
};

const LOCAL_FILE = 'board-main.json';

// 黑板內容轉成存檔格式，前端用的 id 不存
export const toBoardData = (view: BoardView, items: BoardItem[]): BoardData => {
  const rows: Array<Omit<BoardItem, 'id'>> = [];
  for (const it of items) {
    const row: Omit<BoardItem, 'id'> = {
      kind: it.kind,
      x: it.x,
      y: it.y,
      scale: it.scale,
      rotation: it.rotation,
      z: it.z,
    };
    if (it.kind === 'koatag') {
      row.image_id = it.image_id;
    }
    if (it.kind === 'file') {
      row.path = it.path;
    }
    if (it.kind === 'url') {
      row.url = it.url;
    }
    rows.push(row);
  }
  return { version: 1, view: view, items: rows };
};

// 存檔格式轉回黑板內容，每張圖重新給 id
export const fromBoardData = (data: BoardData): { view: BoardView; items: BoardItem[] } => {
  const items: BoardItem[] = [];
  for (const row of data.items || []) {
    items.push({ ...row, id: crypto.randomUUID() });
  }
  let view: BoardView = { x: 0, y: 0, zoom: 1 };
  if (data.view) {
    view = data.view;
  }
  return { view: view, items: items };
};

// 寫進 APP 資料夾，資料夾已存在時 mkdir 不會出錯
export const saveLocalBoard = async (data: BoardData) => {
  await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(LOCAL_FILE, JSON.stringify(data), { baseDir: BaseDirectory.AppData });
};

// 讀回本機暫存，沒有檔案或壞掉回 null
export const loadLocalBoard = async (): Promise<BoardData | null> => {
  try {
    if (!(await exists(LOCAL_FILE, { baseDir: BaseDirectory.AppData }))) {
      return null;
    }
    const text = await readTextFile(LOCAL_FILE, { baseDir: BaseDirectory.AppData });
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.items)) {
      return null;
    }
    return data;
  } catch (e) {
    console.error('[board] 讀取本機暫存失敗', e);
    return null;
  }
};
