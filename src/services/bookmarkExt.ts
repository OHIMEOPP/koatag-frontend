// 跟 KOATAG 書籤擴充套件溝通，走同頁面的 postMessage
const PAGE_SOURCE = 'koatag-bookmarks-page';
const EXT_SOURCE = 'koatag-bookmarks-ext';

export type ExtPing = { ok: boolean; version: string };
export type ExtSession = { ok: boolean; loggedIn: boolean; xUserId?: string };

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
