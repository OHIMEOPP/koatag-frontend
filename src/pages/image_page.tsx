import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Btn, Icon, Data } from 'components';
import { getImagePageInfo } from 'services/pageInfo/image_page.service';
import { parser, getFilePath } from 'utils';

// Step 9.2 — v3 layout shell only.
// Stage 顯示原圖 (無 Magnifier yet, 等 9.3 + 9.3.5)
// Side cards 都 placeholder, 等 9.4-9.6 接入
const Image_page = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user_id = localStorage.getItem('user_id') ?? '0';
    const urlParams = new URLSearchParams(location.search);
    const img_id = urlParams.get('img_id');

    const [imageData, setImageData] = useState<Data | undefined>();

    useEffect(() => {
        if (!img_id) return;
        getImagePageInfo(img_id)
            .then((res) => {
                if (!res) return;
                const parsed = parser(res);
                setImageData(parsed.result);
            })
            .catch((e) => console.error('getImagePageInfo failed', e));
    }, [img_id]);

    if (!img_id) {
        return (
            <div className="page">
                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    缺少 img_id 參數
                </div>
            </div>
        );
    }

    const imgSrc = imageData?.check_img_type === 'HTTP'
        ? imageData.img_path
        : getFilePath(user_id, imageData?.img_path ?? '');

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <Btn variant="ghost" size="sm" icon={<Icon.chevronLeft size={12} />} onClick={() => navigate(-1)}>
                        返回
                    </Btn>
                    <h1 className="t-h1 page-title" style={{ marginTop: 8 }}>圖片詳情</h1>
                    <p className="page-sub">
                        {imageData
                            ? `#${imageData.id} · 上傳於 ${imageData.created_at?.slice(0, 10) ?? '?'}`
                            : '載入中…'}
                    </p>
                </div>
                <div className="v-row v-gap-2">
                    <Btn variant="ghost" size="sm" icon={<Icon.download size={12} />} onClick={() => alert('下載 — 等 Step 9.7 接入')}>
                        下載
                    </Btn>
                    <Btn variant="ghost" size="sm" icon={<Icon.trash size={12} />} onClick={() => alert('刪除功能尚未開放 (Step 12 後端)')}>
                        刪除
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.check size={12} />} onClick={() => alert('儲存變更 — 等 Step 9.7 接入')}>
                        儲存變更
                    </Btn>
                </div>
            </div>

            <div className="detail-grid">
                <div className="detail-stage">
                    {imageData ? (
                        <img src={imgSrc} alt={imageData.img_path} />
                    ) : (
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                            載入中…
                        </div>
                    )}
                </div>

                <div className="detail-side">
                    <div className="card tag-edit-card">
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            [9.4] tag editor inline — 4 區段 + isPublic toggle
                        </div>
                    </div>
                    <div className="card info-card">
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            [9.5] 檔案資訊 + tagAmount [0]/[1] 雙計數
                        </div>
                    </div>
                    <div className="card info-card">
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                            [9.6] AI 辨識 suggestion card
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export { Image_page };
