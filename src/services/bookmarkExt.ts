// 跟 KOATAG 書籤擴充套件溝通，走同頁面的 postMessage
// 桌面版 APP 裝不了擴充套件，改呼叫 Rust
import { invoke } from '@tauri-apps/api/core';
import api from 'api/axios';
import { isDesktop } from 'utils/desktop';

const PAGE_SOURCE = 'koatag-bookmarks-page';
const EXT_SOURCE = 'koatag-bookmarks-ext';

export type ExtPing = { ok: boolean; version: string };
export type ExtSession = { ok: boolean; loggedIn: boolean; xUserId?: string };

export type XKind = 'bookmarks' | 'likes';
export type XAuthor = { id: string; screenName: string; name: string; avatar: string | null };
export type XMedia = { type: string; url: string };
export type XItem = {
  itemId: string;
  author: XAuthor | null;
  text: string;
  createdAt: string;
  media: XMedia[];
  url: string | null;
};
export type ExtPage = {
  ok: boolean;
  status: string;
  kind: XKind;
  items: XItem[];
  nextCursor: string | null;
};

let reqCounter = 0;

// 逾時沒回應就回 null
export const askExt = <T = any>(type: string, extra: Record<string, unknown>, timeoutMs: number): Promise<T | null> => {
  reqCounter = reqCounter + 1;
  const reqId = reqCounter;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve(null);
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window || !event.data || event.data.source !== EXT_SOURCE || event.data.reqId !== reqId) {
        return;
      }
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(event.data as T);
    }

    window.addEventListener('message', onMessage);
    window.postMessage({ source: PAGE_SOURCE, type: type, reqId: reqId, ...extra }, window.location.origin);
  });
};

export const pingExt = () => askExt<ExtPing>('ping', {}, 1500);

export const getXSession = async (): Promise<ExtSession | null> => {
  if (!isDesktop()) {
    return askExt<ExtSession>('session', {}, 5000);
  }
  try {
    return await invoke<ExtSession>('x_session');
  } catch (e) {
    return null;
  }
};

// 桌面版開 X 官方登入頁，登入成功或關掉視窗後會發 x-session-changed
export const openXLoginWindow = () => invoke('x_login');

// 桌面版清掉 APP 裡的 X 登入，不影響 KOATAG 登入
export const logoutX = () => invoke('x_logout');

// 抓一頁 X 書籤或喜歡，cursor 空的是第一頁
type XConfig = { bookmarksQueryId: string | null; likesQueryId: string | null };
type XConfigResponse = { ok: boolean; data: XConfig };

// 後端給的 queryId，APP 開著時只問一次，問不到就交給 APP 用內建值
let xConfigRequest: Promise<XConfig> | null = null;

const getXConfig = (): Promise<XConfig> => {
  if (!xConfigRequest) {
    xConfigRequest = api
      .get<XConfigResponse>('/bookmarks/x-config')
      .then((response) => response.data.data)
      .catch(() => {
        // 這次失敗不記住，下次抓取再問
        xConfigRequest = null;
        return { bookmarksQueryId: null, likesQueryId: null };
      });
  }
  return xConfigRequest;
};

// 桌面版由 APP 隱藏的 x.com 視窗抓
export const fetchXPage = async (kind: XKind, cursor: string | null): Promise<ExtPage | null> => {
  if (!isDesktop()) {
    return askExt<ExtPage>('fetchPage', { kind: kind, cursor: cursor }, 30000);
  }
  const config = await getXConfig();
  try {
    return await invoke<ExtPage>('x_fetch_page', {
      kind: kind,
      cursor: cursor,
      bookmarksQueryId: config.bookmarksQueryId,
      likesQueryId: config.likesQueryId,
    });
  } catch (e) {
    return null;
  }
};
