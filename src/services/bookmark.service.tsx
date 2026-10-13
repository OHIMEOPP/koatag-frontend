import api from "api/axios";
import { XItem } from "services/bookmarkExt";

type ExtensionInfoResponse = { ok: boolean; data: { version: string } };
type SavedResponse = { ok: boolean; data: Array<{ item_id: string }> };

// 查這些 X 貼文哪些已收藏，回已收藏的 item_id
export const getSavedItemIds = async (itemIds: string[]) => {
    const response = await api.get<SavedResponse>(`/bookmarks`, {
        params: { platform: 'x', item_ids: itemIds },
    });
    const ids: string[] = [];
    for (const b of response.data.data) {
        ids.push(b.item_id);
    }
    return ids;
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
    const response = await api.post(`/bookmarks`, payload);
    return response.data;
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
