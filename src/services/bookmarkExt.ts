// 跟 KOATAG 書籤擴充套件溝通，走同頁面的 postMessage
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

export const getXSession = () => askExt<ExtSession>('session', {}, 5000);

// 抓一頁 X 書籤或喜歡，cursor 空的是第一頁
export const fetchXPage = (kind: XKind, cursor: string | null) => askExt<ExtPage>('fetchPage', { kind: kind, cursor: cursor }, 30000);
