import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Btn, Icon, Data, Magnifier } from 'components';
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
    const [zoom, setZoom] = useState(100);
    const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
    const [mirrorSize, setMirrorSize] = useState(200);

    const ZOOM_STEP = 25;
    const MIN_ZOOM = 25;
    const MAX_ZOOM = 400;
    const MIRROR_SIZES = [150, 200, 300, 400, 600] as const;

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
                        <>
                            <Magnifier
                                src={imgSrc}
                                alt={imageData.img_path}
                                mirrorSize={mirrorSize}
                                imgStyle={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center', transition: 'transform var(--transition-fast)', maxWidth: '100%', maxHeight: '80vh' }}
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                                }}
                            />
                            <div className="detail-toolbar">
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                                    disabled={zoom <= MIN_ZOOM}
                                    aria-label="縮小"
                                    title="縮小"
                                >
                                    <Icon.zoomOut size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                                    disabled={zoom >= MAX_ZOOM}
                                    aria-label="放大"
                                    title="放大"
                                >
                                    <Icon.zoomIn size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setZoom(100)}
                                    aria-label="重設"
                                    title="重設 100%"
                                >
                                    <Icon.expand size={14} />
                                </button>
                                <span style={{ width: 1, height: 20, background: 'var(--color-border)', alignSelf: 'center' }} aria-hidden />
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => {
                                        const idx = MIRROR_SIZES.indexOf(mirrorSize as typeof MIRROR_SIZES[number]);
                                        const next = MIRROR_SIZES[(idx + 1) % MIRROR_SIZES.length];
                                        setMirrorSize(next);
                                    }}
                                    aria-label={`放大鏡大小 ${mirrorSize}px`}
                                    title={`放大鏡 ${mirrorSize}px (點擊切換)`}
                                >
                                    <Icon.search size={14} />
                                </button>
                            </div>
                            <div className="detail-zoom">
                                {naturalDims && (
                                    <>
                                        <span>{naturalDims.w} × {naturalDims.h}</span>
                                        <span style={{ color: 'var(--color-border)' }}>|</span>
                                    </>
                                )}
                                <span style={{ color: zoom === 100 ? 'var(--color-text-secondary)' : 'var(--color-text-quaternary)' }}>
                                    {zoom === 100 ? 'fit' : '–'}
                                </span>
                                <span style={{ color: 'var(--color-border)' }}>|</span>
                                <span style={{ color: 'var(--color-primary-light)' }}>{zoom}%</span>
                                <span style={{ color: 'var(--color-border)' }}>|</span>
                                <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Icon.search size={11} />{mirrorSize}px
                                </span>
                            </div>
                        </>
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
