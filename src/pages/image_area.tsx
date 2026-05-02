import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Icon } from 'components';

// Step 7.2 — v3 layout shell only (per user 路線 C: 純 UI now, real list/filter/
// delete/batch endpoints rebuilt in Laravel as Step 12 later).
// Filter panel / image grid / pager are placeholder cards waiting for substeps
// 7.3 (ImageCard visual) → 7.4 (fetch + render) → 7.5+ progressive wire-up.
const Image_area = () => {
    const navigate = useNavigate();

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="t-h1 page-title">圖庫</h1>
                    <p className="page-sub">圖片瀏覽 · 篩選 · 批次編輯</p>
                </div>
                <div className="v-row v-gap-2">
                    <Btn variant="ghost" size="sm" icon={<Icon.edit size={12} />} onClick={() => alert('批次編輯 — 等 Step 7.7 接入')}>
                        批次編輯
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={() => navigate('/main/upload_area')}>
                        上傳
                    </Btn>
                </div>
            </div>

            <div className="gallery-shell">
                <aside className="card filter-panel">
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [7.5] Filter panel — 排序 / 標籤分類 / 公開狀態 / Active tags
                    </div>
                </aside>

                <div>
                    <div className="gallery-toolbar">
                        <span className="toolbar-meta">[7.6] toolbar 待接 — meta / 排序 / view-toggle</span>
                    </div>

                    <div className="card" style={{ padding: 24, color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [7.4] image grid — 接 getImageForImageReposity，渲染 v3 ImageCard
                    </div>

                    <div className="card" style={{ padding: 16, marginTop: 20, color: 'var(--color-text-tertiary)', fontSize: 13, textAlign: 'center' }}>
                        [7.8] pager — v3 page-btn
                    </div>
                </div>
            </div>
        </div>
    );
};

export { Image_area };
