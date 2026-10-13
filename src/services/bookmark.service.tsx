import api from "api/axios";
import { XItem } from "services/bookmarkExt";

type ExtensionInfoResponse = { ok: boolean; data: { version: string } };
type SavedResponse = { ok: boolean; data: Array<{ id: number; item_id: string }> };
type SaveResponse = { ok: boolean; data: { id: number; item_id: string } };

export type BookmarkRow = {
  id: number;
  item_id: string;
  author_id: string | null;
  author_handle: string | null;
  author_name: string | null;
  text: string | null;
  url: string | null;
  media: Array<{ type: string; url: string }> | null;
  posted_at: string | null;
};
type SavedPageResponse = {
  ok: boolean;
  data: BookmarkRow[];
  meta: { page: number; per_page: number; total: number; last_page: number };
};

// 已收藏列表，新收藏的在前
export const getSavedPage = async (page: number) => {
    const response = await api.get<SavedPageResponse>(`/bookmarks`, {
        params: { platform: 'x', page: page, per_page: 20 },
    });
    return response.data;
}

// 收藏紀錄轉成卡片用的格式，頭像沒存所以空著
export const bookmarkToItem = (row: BookmarkRow): XItem => {
    let author = null;
    if (row.author_handle) {
        author = {
            id: row.author_id || '',
            screenName: row.author_handle,
            name: row.author_name || row.author_handle,
            avatar: null,
        };
    }
    return {
        itemId: row.item_id,
        author: author,
        text: row.text || '',
        createdAt: row.posted_at || '',
        media: row.media || [],
        url: row.url,
    };
}

// 查這些 X 貼文哪些已收藏，回 item_id 對應的收藏 id，取消收藏要用
export const getSavedItemIds = async (itemIds: string[]) => {
    const response = await api.get<SavedResponse>(`/bookmarks`, {
        params: { platform: 'x', item_ids: itemIds },
    });
    const saved: Array<{ itemId: string; id: number }> = [];
    for (const b of response.data.data) {
        saved.push({ itemId: b.item_id, id: b.id });
    }
    return saved;
}

// 取消收藏
export const deleteBookmark = async (id: number) => {
    await api.delete(`/bookmarks/${id}`);
}

// 收藏一則 X 貼文，已收藏過後端會回既有那筆
export const saveBookmark = async (item: XItem, xUserId: string) => {
    let postedAt = null;
    const d = new Date(item.createdAt);
    if (item.createdAt && !isNaN(d.getTime())) {
        postedAt = d.toISOString();
    }

    const payload = {
        platform: 'x',
        item_id: item.itemId,
        source_account_id: xUserId || null,
        author_id: item.author ? item.author.id : null,
        author_handle: item.author ? item.author.screenName : null,
        author_name: item.author ? item.author.name : null,
        text: item.text || null,
        url: item.url,
        media: item.media,
        posted_at: postedAt,
    };
    const response = await api.post<SaveResponse>(`/bookmarks`, payload);
    return response.data.data.id;
}

// 擴充套件目前版本，拿來跟使用者裝的比對
export const getExtensionVersion = async () => {
    const response = await api.get<ExtensionInfoResponse>(`/bookmarks/extension`);
    return response.data.data.version;
}

// 下載擴充套件 zip，要帶 JWT 所以用 blob 抓下來再存檔
export const downloadExtension = async (version: string) => {
    const response = await api.get(`/bookmarks/extension.zip`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = version ? `koatag-bookmarks-${version}.zip` : 'koatag-bookmarks.zip';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// a 比 b 舊就回 true，版本格式 x.y.z
export const isOlderVersion = (a: string, b: string) => {
    const pa = a.split('.');
    const pb = b.split('.');
    for (let i = 0; i < 3; i++) {
        const na = parseInt(pa[i] || '0', 10);
        const nb = parseInt(pb[i] || '0', 10);
        if (na < nb) {
            return true;
        }
        if (na > nb) {
            return false;
        }
    }
    return false;
}
