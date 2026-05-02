import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Icon } from 'components';

// Step 6.2 — v3 layout shell only.
// Profile section is real (data from localStorage), but tag library / aside stats / etc.
// are placeholder cards waiting for substeps 6.3-6.9 to fill in.
const Front_page = () => {
    const navigate = useNavigate();
    const userRaw = localStorage.getItem('user');
    const user = userRaw ? JSON.parse(userRaw) : null;
    const account: string = user?.account ?? 'guest';
    const initial = account.slice(0, 2).toUpperCase();

    const handleHeroEdit = () => alert('編輯封面 — 等 Step 6.9 接入');
    const handleEditProfile = () => alert('編輯資料 — 等 Step 6.7 接入');
    const handleUpload = () => navigate('/main/upload_area');

    return (
        <div className="page">
            <div className="profile-hero">
                <Btn variant="ghost" size="sm" className="hero-edit" icon={<Icon.edit size={12} />} onClick={handleHeroEdit}>
                    編輯封面
                </Btn>
            </div>
            <div className="profile-info">
                <div className="big-avatar">{initial}</div>
                <div className="profile-meta">
                    <h1 className="profile-name">
                        {account}
                        <span className="verified"><Icon.check size={11} /></span>
                    </h1>
                    <p className="profile-handle">@{account} · Pro 會員</p>
                </div>
                <div className="profile-actions">
                    <Btn variant="secondary" size="sm" icon={<Icon.edit size={12} />} onClick={handleEditProfile}>
                        編輯資料
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={handleUpload}>
                        上傳圖片
                    </Btn>
                </div>
            </div>

            <div className="front-grid">
                <div className="front-main">
                    <div className="card" style={{ padding: 24, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [6.4] 我的標籤 — Tags library 將取代既有 TagBlog
                    </div>
                    <div className="card" style={{ padding: 24, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [6.6] 最近活動 — Recent activity，依原始 design 補回
                    </div>
                    <div className="card" style={{ padding: 24, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [6.8] 參考標籤 — PublicTagBlog 既有功能搬 v3 殼
                    </div>
                </div>
                <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 64 }}>
                    <div className="card" style={{ padding: 18, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [6.5] 內容統計 — 接 tags?.images_Amount 等真實欄位
                    </div>
                    <div className="card" style={{ padding: 18, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [6.5] 標籤分佈 — bar-viz
                    </div>
                    <div className="card" style={{ padding: 18, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [6.5] AI 建議 — placeholder
                    </div>
                </aside>
            </div>
        </div>
    );
};

export { Front_page };
