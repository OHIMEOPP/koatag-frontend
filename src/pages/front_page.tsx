import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileHero } from 'components';

import "cropperjs/dist/cropper.css";

// Step 6.3 — Profile section now real (ProfileHero handles wallpaper + avatar +
// Cropper upload). Tag library / aside stats / etc. still placeholder cards waiting
// for substeps 6.4-6.9.
const Front_page = () => {
    const navigate = useNavigate();

    const handleEditProfile = () => alert('編輯資料 — 等 Step 6.7 接入 TagEditor');
    const handleUpload = () => navigate('/main/upload_area');

    return (
        <div className="page">
            <ProfileHero onEditProfile={handleEditProfile} onUpload={handleUpload} />

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
