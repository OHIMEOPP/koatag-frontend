import api from 'api/axios';
import { BaseDirectory, exists, mkdir, readFile, readTextFile, writeFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { sha1 } from '@noble/hashes/legacy.js';
import { bytesToHex } from '@noble/hashes/utils.js';
import { ImageData } from 'components';
import { BoardItem, BoardView } from 'components/board/types';
import { getFilePath, getUserId } from 'utils';
import { UploadImage } from 'services/image.service';

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

// 每個視窗一個暫存檔，主視窗 board-main.json，其他視窗 label 本身就是 board- 開頭
export const localBoardFile = (label: string): string => {
  if (label.startsWith('board-')) {
    return label + '.json';
  }
  return 'board-' + label + '.json';
};

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
export const saveLocalBoard = async (label: string, data: BoardData) => {
  await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
  await writeTextFile(localBoardFile(label), JSON.stringify(data), { baseDir: BaseDirectory.AppData });
};

// 讀回本機暫存，沒有檔案或壞掉回 null
export const loadLocalBoard = async (label: string): Promise<BoardData | null> => {
  const file = localBoardFile(label);
  try {
    if (!(await exists(file, { baseDir: BaseDirectory.AppData }))) {
      return null;
    }
    const text = await readTextFile(file, { baseDir: BaseDirectory.AppData });
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

const isHttpUrl = (text: string): boolean => {
  return text.startsWith('http://') || text.startsWith('https://');
};

// 從瀏覽器拖進來的資料找圖片網址
// 先看 html 裡的 img，圖片外面包連結時 uri-list 會是連結網址
export const imageUrlFromDrop = (data: DataTransfer): string | null => {
  const html = data.getData('text/html');
  if (html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const img = doc.querySelector('img');
    if (img) {
      const src = img.getAttribute('src') || '';
      if (isHttpUrl(src)) {
        return src;
      }
    }
  }

  const uriList = data.getData('text/uri-list');
  for (const line of uriList.split('\n')) {
    const url = line.trim();
    // uri-list 裡 # 開頭是註解
    if (url && !url.startsWith('#') && isHttpUrl(url)) {
      return url;
    }
  }

  return null;
};

// 電腦檔案只收這幾種圖
const LOCAL_IMAGE_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};
const LOCAL_IMAGE_MAX_BYTES = 50 * 1024 * 1024;

// 本機複本檔名對應的圖片網址，同一個檔只讀一次
const localUrlCache = new Map<string, Promise<string | null>>();

// 電腦檔案複製一份到 APP 資料夾，檔名用內容的 SHA1，回傳檔名
// 不是圖或太大回 null
export const copyLocalImage = async (file: File): Promise<string | null> => {
  const ext = LOCAL_IMAGE_EXT[file.type];
  if (!ext || file.size > LOCAL_IMAGE_MAX_BYTES) {
    return null;
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = 'img-' + bytesToHex(sha1(bytes)) + '.' + ext;

  // 同一張圖拖過就不再寫
  if (!(await exists(name, { baseDir: BaseDirectory.AppData }))) {
    await mkdir('', { baseDir: BaseDirectory.AppData, recursive: true });
    await writeFile(name, bytes, { baseDir: BaseDirectory.AppData });
  }

  localUrlCache.set(name, Promise.resolve(URL.createObjectURL(new Blob([bytes], { type: file.type }))));
  return name;
};

// 讀本機複本轉成圖片網址，檔案不在回 null
export const localImageUrl = (name: string): Promise<string | null> => {
  const cached = localUrlCache.get(name);
  if (cached) {
    return cached;
  }
  const request = readFile(name, { baseDir: BaseDirectory.AppData })
    .then((bytes) => URL.createObjectURL(new Blob([bytes])))
    .catch(() => {
      localUrlCache.delete(name);
      return null;
    });
  localUrlCache.set(name, request);
  return request;
};

// 看檔頭判斷圖片格式，不認得回 null
const imageTypeOf = (bytes: Uint8Array): { ext: string; mime: string } | null => {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { ext: 'gif', mime: 'image/gif' };
  }
  // RIFF....WEBP
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
};

// 黑板上的圖取出內容，本機複本讀檔，網頁圖交給 Rust 下載
const itemBytes = async (item: BoardItem): Promise<Uint8Array> => {
  if (item.kind === 'file' && item.path) {
    return readFile(item.path, { baseDir: BaseDirectory.AppData });
  }
  if (item.kind === 'url' && item.url) {
    const buffer = await invoke<ArrayBuffer>('fetch_image', { url: item.url });
    return new Uint8Array(buffer);
  }
  throw new Error('這張圖不能存進圖庫');
};

export type SaveToGalleryResult = { status: 'saved' | 'exists'; imageId: number };

// 黑板上的圖存進圖庫，走一般上傳，重複的圖後端會擋
// 上傳不回 id，用 SHA1 檔名查回來
export const saveItemToGallery = async (item: BoardItem, anotherTag: string | null): Promise<SaveToGalleryResult> => {
  const bytes = await itemBytes(item);
  const type = imageTypeOf(bytes);
  if (!type) {
    throw new Error('不是支援的圖片格式');
  }
  const filename = bytesToHex(sha1(bytes)) + '.' + type.ext;

  const formData = new FormData();
  formData.append('uploadimg[]', new File([bytes], filename, { type: type.mime }));
  formData.append('check_img_type', 'normal');
  if (anotherTag) {
    formData.append('another_tag', anotherTag);
  }
  if (item.kind === 'url' && item.url) {
    formData.append('source', item.url);
  }

  const response = await UploadImage(formData);
  let status: 'saved' | 'exists' = 'saved';
  if (response.status === 2) {
    status = 'exists';
  } else if (response.status !== 1) {
    throw new Error(response.message || '上傳失敗');
  }

  const found = await api.get<FindOneResponse>(`/image/findOneImg/img_path/${filename}`);
  const image = found.data.result;
  if (!image || !image.id) {
    throw new Error('找不到剛存進去的圖');
  }

  // 之後顯示這張圖不用再查網址
  rememberKoatagUrl(image.id, getFilePath(getUserId(), image.img_path));
  return { status: status, imageId: image.id };
};

// 複製到剪貼簿的格式，前綴讓貼上時認得是黑板的圖
const CLIPBOARD_PREFIX = 'koatag-board:';

// 黑板上的圖轉成剪貼簿文字，沿用存檔格式所以不帶 id
export const boardItemToClipboard = (item: BoardItem): string => {
  const data = toBoardData({ x: 0, y: 0, zoom: 1 }, [item]);
  return CLIPBOARD_PREFIX + JSON.stringify({ version: data.version, items: data.items });
};

// 剪貼簿文字轉回圖片資料，不是黑板的格式或內容不對回 null
export const boardItemsFromClipboard = (text: string): Array<Omit<BoardItem, 'id'>> | null => {
  if (!text || !text.startsWith(CLIPBOARD_PREFIX)) {
    return null;
  }
  let data = null;
  try {
    data = JSON.parse(text.slice(CLIPBOARD_PREFIX.length));
  } catch (e) {
    return null;
  }
  if (!data || !Array.isArray(data.items)) {
    return null;
  }

  // 剪貼簿可能被別的程式改過，每個欄位都檢查
  const rows: Array<Omit<BoardItem, 'id'>> = [];
  for (const it of data.items) {
    if (typeof it.x !== 'number' || typeof it.y !== 'number' || typeof it.scale !== 'number' || it.scale <= 0) {
      continue;
    }
    const row: Omit<BoardItem, 'id'> = {
      kind: it.kind,
      x: it.x,
      y: it.y,
      scale: it.scale,
      rotation: typeof it.rotation === 'number' ? it.rotation : 0,
      z: 0,
    };
    if (it.kind === 'koatag' && Number.isInteger(it.image_id) && it.image_id > 0) {
      row.image_id = it.image_id;
    } else if (it.kind === 'file' && typeof it.path === 'string' && /^img-[0-9a-f]{40}\.(jpg|png|gif|webp)$/.test(it.path)) {
      row.path = it.path;
    } else if (it.kind === 'url' && typeof it.url === 'string' && (it.url.startsWith('http://') || it.url.startsWith('https://'))) {
      row.url = it.url;
    } else {
      continue;
    }
    rows.push(row);
  }
  if (rows.length === 0) {
    return null;
  }
  return rows;
};
