import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// 「參考標籤」card — 既有 PublicTagBlog 行為搬到 v3 .tags-card 殼。
// 4 個 tab: 標籤 / 作者 / 人物 / 團體，點擊呼叫 NodeRED `getRefrenceTag` 撈
// 「其他使用者公開且自己沒有的 tag」。chip click 跳 image_area。
// 不走 api/axios 的 interceptor (那是 GET→NodeRED, POST→Laravel 二分)，這裡是
// POST→NodeRED 例外，直接用 axios + 環境變數的 NodeRED base URL。
const PUBLIC_TABS: Array<{ id: string; label: string }> = [
    { id: 'tag_name',      label: '標籤' },
    { id: 'ArtistTag',     label: '作者' },
    { id: 'mainTag',       label: '人物' },
    { id: 'secondaryTag',  label: '團體' },
];

const PublicTagsCard: React.FC = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchPublicTags = async (colume: string) => {
        const user_id = localStorage.getItem('user_id');
        setActiveTab(colume);
        setLoading(true);
        try {
            const response = await axios.post<string[]>(
                `${process.env.REACT_APP_NODERED_API_URL}/getRefrenceTag`,
                { colume, user_id },
                { headers: { 'Content-Type': 'application/json' } },
            );
            setTags(response.data ?? []);
        } catch (e) {
            console.error('getRefrenceTag failed', e);
            setTags([]);
        } finally {
            setLoading(false);
        }
    };

    const handleChipClick = (tagName: string) => {
        navigate(`/main/image_area?page=1&tag=${encodeURIComponent(tagName)}`);
    };

    return (
        <div className="card tags-card">
            <div className="tags-head">
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>參考標籤</h3>
                <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-mono)', fontSize: 11 }}>
                    其他使用者公開的標籤
                </span>
            </div>
            <div style={{ height: 14 }} />
            <div className="tag-tabs">
                {PUBLIC_TABS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`tag-tab ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => fetchPublicTags(t.id)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <div className="tags-flow">
                {loading ? (
                    <span style={{ color: 'var(--color-text-quaternary)', fontSize: 13 }}>載入中…</span>
                ) : !activeTab ? (
                    <span style={{ color: 'var(--color-text-quaternary)', fontSize: 13 }}>選一個分類查看可參考的標籤</span>
                ) : tags.length === 0 ? (
                    <span style={{ color: 'var(--color-text-quaternary)', fontSize: 13 }}>沒有可參考的標籤</span>
                ) : (
                    tags.map((tagName, i) => (
                        <span
                            key={`${tagName}-${i}`}
                            className="chip"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleChipClick(tagName)}
                            title="點擊跳到圖庫"
                        >
                            {tagName}
                        </span>
                    ))
                )}
            </div>
        </div>
    );
};

export { PublicTagsCard };
