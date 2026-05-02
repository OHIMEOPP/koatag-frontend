import React, { useEffect, useRef, useState } from 'react';

interface MagnifierProps {
    src: string;
    alt?: string;
    initialZoom?: number;
    minZoom?: number;
    maxZoom?: number;
    mirrorSize?: number;
    onLoad?: (e: React.SyntheticEvent<HTMLImageElement>) => void;
    imgStyle?: React.CSSProperties;
    className?: string;
}

// 放大鏡 hover loupe — 滑鼠移到主圖上會出現一個圓形 mirror box，顯示游標位置
// 周邊區域的放大圖。滑鼠滾輪在 mirror 內可調整放大倍率 (initialZoom 預設 3，min/max 2/10)。
// 全部 DOM 透過 useRef 取，event listener 在 useEffect 內 add + cleanup return 時 remove。
const Magnifier: React.FC<MagnifierProps> = ({
    src,
    alt = '',
    initialZoom = 3,
    minZoom = 2,
    maxZoom = 10,
    mirrorSize = 200,
    onLoad,
    imgStyle,
    className = '',
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mainImgRef = useRef<HTMLImageElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const zoomImgRef = useRef<HTMLImageElement>(null);
    const scaleRef = useRef(initialZoom);
    const lastMouse = useRef({ x: 0, y: 0 });
    const isLockedRef = useRef(false);
    const [isLocked, setIsLocked] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const mainImg = mainImgRef.current;
        const mirror = mirrorRef.current;
        const zoomImg = zoomImgRef.current;
        if (!container || !mainImg || !mirror || !zoomImg) return;

        const updateMirror = (mouseX: number, mouseY: number) => {
            // mouseX / mouseY are RELATIVE to mainImg's display rect
            const displayW = mainImg.offsetWidth;
            const displayH = mainImg.offsetHeight;
            const scale = scaleRef.current;
            const mirrorW = mirror.offsetWidth;
            const mirrorH = mirror.offsetHeight;

            // Position mirror centered on cursor (relative to container)
            const containerRect = container.getBoundingClientRect();
            const imgRect = mainImg.getBoundingClientRect();
            const cursorInContainer = {
                x: mouseX + (imgRect.left - containerRect.left),
                y: mouseY + (imgRect.top - containerRect.top),
            };
            mirror.style.left = `${cursorInContainer.x - mirrorW / 2}px`;
            mirror.style.top = `${cursorInContainer.y - mirrorH / 2}px`;

            // Scale zoom img to match displayed size (so mouse coord maps 1:1 before scale)
            zoomImg.style.width = `${displayW}px`;
            zoomImg.style.height = `${displayH}px`;
            zoomImg.style.transform = `scale(${scale})`;
            zoomImg.style.transformOrigin = 'top left';

            // Offset zoom img so cursor position appears at center of mirror
            zoomImg.style.left = `${mirrorW / 2 - mouseX * scale}px`;
            zoomImg.style.top = `${mirrorH / 2 - mouseY * scale}px`;
        };

        const handleMouseMove = (e: MouseEvent) => {
            // Locked 時 mirror 凍結在最後位置, 不再 follow cursor
            if (isLockedRef.current) return;
            const rect = mainImg.getBoundingClientRect();
            const inside =
                e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (!inside) {
                mirror.style.display = 'none';
                return;
            }
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            lastMouse.current = { x: mouseX, y: mouseY };
            mirror.style.display = 'block';
            updateMirror(mouseX, mouseY);
        };

        const handleMouseLeave = () => {
            // Locked 時即使滑鼠離開圖片區也保持 mirror 顯示
            if (isLockedRef.current) return;
            mirror.style.display = 'none';
        };

        const handleWheel = (e: WheelEvent) => {
            const rect = mainImg.getBoundingClientRect();
            const inside =
                e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (!inside) return;
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.5 : 0.5;
            scaleRef.current = Math.max(minZoom, Math.min(maxZoom, scaleRef.current + delta));
            // Locked 時 wheel 仍可調縮放, 用 lastMouse 為錨點 (鎖定位置不變, 只改放大倍率)
            updateMirror(lastMouse.current.x, lastMouse.current.y);
        };

        // 點圖片 toggle 鎖定 (lock = mirror 凍結, unlock = follow cursor 恢復)
        const handleClick = (e: MouseEvent) => {
            const rect = mainImg.getBoundingClientRect();
            const inside =
                e.clientX >= rect.left && e.clientX <= rect.right &&
                e.clientY >= rect.top && e.clientY <= rect.bottom;
            if (!inside) return;
            const next = !isLockedRef.current;
            isLockedRef.current = next;
            setIsLocked(next);
            // 鎖定時 mirror 強制顯示在最後位置, 即使原本因 mouseleave 已隱藏
            if (next) {
                mirror.style.display = 'block';
                updateMirror(lastMouse.current.x, lastMouse.current.y);
            }
        };

        container.addEventListener('mousemove', handleMouseMove);
        container.addEventListener('mouseleave', handleMouseLeave);
        container.addEventListener('wheel', handleWheel, { passive: false });
        container.addEventListener('click', handleClick);

        return () => {
            container.removeEventListener('mousemove', handleMouseMove);
            container.removeEventListener('mouseleave', handleMouseLeave);
            container.removeEventListener('wheel', handleWheel);
            container.removeEventListener('click', handleClick);
        };
    }, [minZoom, maxZoom]);

    return (
        <div ref={containerRef} className={`magnifier-container ${className}`}>
            <img ref={mainImgRef} src={src} alt={alt} className="magnifier-main" style={imgStyle} onLoad={onLoad} />
            <div
                ref={mirrorRef}
                className={`magnifier-mirror ${isLocked ? 'is-locked' : ''}`}
                aria-hidden
                style={{ width: mirrorSize, height: mirrorSize }}
            >
                <img ref={zoomImgRef} src={src} alt="" className="magnifier-zoom" />
            </div>
        </div>
    );
};

export { Magnifier };
