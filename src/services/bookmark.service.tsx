import api from "api/axios";

type ExtensionInfoResponse = { ok: boolean; data: { version: string } };

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
