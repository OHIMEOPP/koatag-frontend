import { useEffect, useRef } from "react";
import "../../style/Magnifier.scss";

interface MagnifierProps {
    src: string;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;
}

function Magnifier({
    src,
    zoom = 3,
    minZoom = 2,
    maxZoom = 10,
}: MagnifierProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const mirrorRef = useRef<HTMLDivElement>(null);
    const bigImgRef = useRef<HTMLImageElement>(null);

    const scaleRef = useRef(zoom);
    const lastMouse = useRef({ x: 0, y: 0 });

    const updateBigImg = (mouseX: number, mouseY: number) => {
        const container = containerRef.current;
        const mirror = mirrorRef.current;
        const bigImg = bigImgRef.current;
        if (!container || !mirror || !bigImg) return;

        const imgWidth = bigImg.naturalWidth;
        const imgHeight = bigImg.naturalHeight;
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;
        const scale = scaleRef.current;

        // 鏡子中央對齊滑鼠
        mirror.style.display = "block";
        mirror.style.left = `${mouseX - mirror.offsetWidth / 2}px`;
        mirror.style.top = `${mouseY - mirror.offsetHeight / 2}px`;

        // 計算滑鼠在原圖上的比例
        const percentX = mouseX / containerWidth / 2;
        const percentY = mouseY / containerHeight / 2;

        // 大圖偏移，使鏡子中心對應滑鼠
        const left = -percentX * imgWidth * scale + mirror.offsetWidth / 2;
        const top = -percentY * imgHeight * scale + mirror.offsetHeight / 2;

        bigImg.style.transform = `scale(${scale})`;
        bigImg.style.transformOrigin = "top left";
        bigImg.style.left = `${left}px`;
        bigImg.style.top = `${top}px`;
    };

    const handleMouseMove = (e: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        lastMouse.current = { x: mouseX, y: mouseY };
        updateBigImg(mouseX, mouseY);
    };

    const handleMouseLeave = () => {
        const mirror = mirrorRef.current;
        if (mirror) mirror.style.display = "none";
    };

    const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.5 : 0.5;
        scaleRef.current = Math.min(Math.max(scaleRef.current + delta, minZoom), maxZoom);

        const { x, y } = lastMouse.current;
        updateBigImg(x, y);
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        container.addEventListener("mousemove", handleMouseMove);
        container.addEventListener("mouseleave", handleMouseLeave);
        container.addEventListener("wheel", handleWheel, { passive: false });

        return () => {
            container.removeEventListener("mousemove", handleMouseMove);
            container.removeEventListener("mouseleave", handleMouseLeave);
            container.removeEventListener("wheel", handleWheel);
        };
    }, []);

    return (
        <div className="magnifier-container" ref={containerRef}>
            <img  id="whole_img" src={src} alt="main" className="" />
            <div className="mirror" id="mirror" ref={mirrorRef}>
                <img id="zoomImg" src={src} ref={bigImgRef} alt="zoomed" />
            </div>
        </div>

                // <div className="display_img">
                //     <div className="whole_img" id="container" ref={oContainer}>
                //         <img
                //             id="whole_img"
                //             ref={whole_imgRef}
                //             src={
                //                 imageData?.check_img_type === "HTTP"
                //                     ? imageData?.img_path
                //                     : `${getFilePath(user_id, imageData?.img_path)}`
                //             }
                //             className="col-xs-12 col-sm-4 thumbnail"
                //             alt="..."
                //         />
                //         <div id="mirror">
                //             <img
                //                 id="zoomImg"
                //                 src={
                //                     imageData?.check_img_type === "HTTP"
                //                         ? imageData?.img_path
                //                         : `${getFilePath(user_id, imageData?.img_path)}`
                //                 }
                //                 alt=""
                //             />
                //         </div>
                //     </div>
                // </div>
    );
}

export { Magnifier };
