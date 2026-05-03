import React, { useState } from 'react';
import { Icon, Magnifier } from 'components';

interface DetailStageProps {
    imgSrc: string;
    alt?: string;
    onNaturalDimsLoad?: (dims: { w: number; h: number }) => void;
}

const ZOOM_STEP = 25;
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;
const MIRROR_SIZES = [150, 200, 300, 400, 600] as const;

// 大圖 stage 區: Magnifier + zoom toolbar + zoom indicator
// zoom / mirrorSize 純 stage 內部 state, naturalDims 透過 callback 上拋給 parent
// (parent 用來顯示在 FileInfoCard 的「尺寸」row)
const DetailStage: React.FC<DetailStageProps> = ({ imgSrc, alt, onNaturalDimsLoad }) => {
    const [zoom, setZoom] = useState(100);
    const [mirrorSize, setMirrorSize] = useState(200);
    const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);

    return (
        <div className="detail-stage">
            <Magnifier
                src={imgSrc}
                alt={alt}
                mirrorSize={mirrorSize}
                imgStyle={{
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: 'center',
                    transition: 'transform var(--transition-fast)',
                    maxWidth: '100%',
                    maxHeight: '80vh',
                }}
                onLoad={(e) => {
                    const img = e.currentTarget;
                    const dims = { w: img.naturalWidth, h: img.naturalHeight };
                    setNaturalDims(dims);
                    onNaturalDimsLoad?.(dims);
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
        </div>
    );
};

export { DetailStage };
