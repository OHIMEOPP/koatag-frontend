import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Magnifier } from '../Magnifier/Magnifier';
import { Icon } from '../Icon';

interface FullscreenViewerProps {
    src: string;
    alt?: string;
    open: boolean;
    onClose: () => void;
    // 跨 origin（如 Drive signed URL）需 "anonymous"，配 backend CORS spec §17.7c
    crossOrigin?: "anonymous" | "use-credentials";
}

const MIRROR_SIZES = [150, 200, 300, 400, 600] as const;

// CSS overlay 全螢幕看圖 — 走 React Portal 避免父層 transform/overflow 截斷
// 內嵌 Magnifier 保留 hover loupe + click 鎖定 + 滾輪縮放體驗
// ESC 關閉, 點黑底空白處關閉 (圖本體 stopPropagation), open 期間 body overflow lock
const FullscreenViewer: React.FC<FullscreenViewerProps> = ({ src, alt, open, onClose, crossOrigin }) => {
    const [mirrorSize, setMirrorSize] = useState<typeof MIRROR_SIZES[number]>(200);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!open) return null;

    return createPortal(
        <div className="fs-viewer" onClick={onClose} role="dialog" aria-modal="true">
            <div className="fs-toolbar" onClick={(e) => e.stopPropagation()}>
                <button
                    type="button"
                    className="fs-icon-btn"
                    onClick={() => {
                        const idx = MIRROR_SIZES.indexOf(mirrorSize);
                        setMirrorSize(MIRROR_SIZES[(idx + 1) % MIRROR_SIZES.length]);
                    }}
                    aria-label={`放大鏡大小 ${mirrorSize}px`}
                    title={`放大鏡 ${mirrorSize}px (點擊切換)`}
                >
                    <Icon.search size={16} />
                    <span className="fs-icon-label">{mirrorSize}</span>
                </button>
                <button
                    type="button"
                    className="fs-icon-btn"
                    onClick={onClose}
                    aria-label="關閉"
                    title="關閉 (Esc)"
                >
                    <Icon.x size={18} />
                </button>
            </div>
            <div className="fs-stage" onClick={(e) => e.stopPropagation()}>
                <Magnifier
                    src={src}
                    alt={alt}
                    mirrorSize={mirrorSize}
                    crossOrigin={crossOrigin}
                    imgStyle={{
                        maxWidth: '95vw',
                        maxHeight: '95vh',
                        display: 'block',
                    }}
                />
            </div>
        </div>,
        document.body,
    );
};

export { FullscreenViewer };
