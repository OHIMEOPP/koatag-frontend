import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Data, ProfileHero, TagsCard } from 'components';
import { getImageForFront } from 'services/pageInfo/front_page.service';

import "cropperjs/dist/cropper.css";

// Step 6.4 — Profile + 我的標籤 card real. Aside stats / Recent activity / 參考標籤
// still placeholder (6.5 / 6.6 / 6.8).
const Front_page = () => {
    const navigate = useNavigate();
    const [tags, setTags] = useState<Data>();

    useEffect(() => {
        getImageForFront()
            .then((res) => setTags(res?.result))
            .catch((e) => console.error('getImageForFront failed', e));
    }, []);

    const handleEditProfile = () => alert('編輯資料 — 等 Step 6.7 接入 TagEditor');
    const handleOpenEditor = () => alert('新增 / 編輯標籤 — 等 Step 6.7 接入 TagEditor');
    const handleUpload = () => navigate('/main/upload_area');

    return (
        <div className="page">
            <ProfileHero onEditProfile={handleEditProfile} onUpload={handleUpload} />

            <div className="front-grid">
                <div className="front-main">
                    <TagsCard tags={tags} onOpenEditor={handleOpenEditor} />
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
