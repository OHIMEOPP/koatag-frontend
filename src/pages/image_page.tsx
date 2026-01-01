import { useEffect, useRef, useState } from 'react';
import { parser, getFilePath } from 'utils'

import { Data, ImageEditor } from 'components'
import { getImagePageInfo } from 'services/pageInfo/image_page.service';
import TagLink from 'utils/TagLink/TagLink';

import '../style/image_page/image_page.scss';


const Image_page = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const user_id = localStorage.getItem('user_id')  ?? '0';
    const img_id = urlParams.get('img_id');
    const [imageData, setImageData] = useState<Data>();
    const oContainer = useRef<HTMLDivElement>(null);
    const [isPublic, setIsPublic] = useState(true);
    const [windowDisplay, SetWindowDisplay] = useState(false);
    const [isScrollDisabled, setIsScrollDisabled] = useState(false);
    document.body.classList.toggle('no-scroll', isScrollDisabled);

    useEffect(() => {
        // asd();
        if (!img_id) return
        getImagePageInfo(img_id)
            .then(res => {
                if (!res) return;
                const parseData = parser(res);
                setImageData(parseData.result);
            })
    }, [img_id])
    useEffect(() => {
        if (imageData) {
            setIsPublic(imageData.is_public === 'public' ? true : false)
            // 在這裡可以根據 imageData 的資料去 setState 或執行邏輯
        }
    }, [imageData]);

    const whole_imgRef = useRef<HTMLImageElement>(null);
    function downLoad() {
        const whole_img = whole_imgRef.current;
        if (!whole_img) return;

        const imgPath = getFilePath(user_id, imageData?.img_path ?? '') || "download.png"; // fallback 預設檔名
        const fileName = imgPath.split("/").pop() || "download.png"; // 取最後的檔名

        const link = document.createElement("a");
        link.href = whole_img.src;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link); // 清掉
    }

    function deleteIMG() {
        // eslint-disable-next-line no-restricted-globals
        if (confirm("要刪除此圖片嗎")) {
            window.location.href = "deleteImg.php?img_id={{$imageData->img_id }}";
        }
    }


    function setimg_formation() {
        SetWindowDisplay(!windowDisplay);
        // window.scrollBy(0, -10000);
        setIsScrollDisabled(!isScrollDisabled);

    }

    // 放大鏡區------------------------------------------------
    // let oContainer = document.querySelector('#container')

    let oMirror = document.querySelector('#mirror') as HTMLElement
    let oBigImg = document.querySelector('#zoomImg') as HTMLImageElement
    let lastMouseX = 0;
    let lastMouseY = 0;
    let scale = 3;

    function mirrorFollow(e: MouseEvent) {
        if (!oContainer.current || !whole_imgRef.current) return;

        // 取得圖片邊界
        const bounds = whole_imgRef.current.getBoundingClientRect();

        // 取得滑鼠座標 (相對於整個頁面)
        const mouseX = e.clientX + window.scrollX;
        const mouseY = e.clientY + window.scrollY;
        
        // 判斷滑鼠是否在圖片範圍內
        const inside =
            mouseX >= bounds.left + window.scrollX &&
            mouseX <= bounds.right + window.scrollX &&
            mouseY >= bounds.top + window.scrollY &&
            mouseY <= bounds.bottom + window.scrollY;

        if (!inside) {
            oMirror.style.display = "none"; // 滑鼠跑出圖片 → 隱藏
            return;
        }

        if (!oContainer.current) return
        oMirror.style.display = 'block';
        let dis_left = e.clientX - oContainer.current.offsetLeft
        let dis_top = e.clientY - oContainer.current.offsetTop

        lastMouseX = dis_left;
        lastMouseY = dis_top;

        // 放大鏡框中央對齊鼠標
        oMirror.style.left = dis_left - oMirror.offsetWidth / 2 + window.scrollX + 'px'
        oMirror.style.top = dis_top - oMirror.offsetHeight / 2 + window.scrollY + 'px'

        Mirror(dis_left, dis_top)
    }


    // 滑鼠滾輪控制大圖縮放倍率
    wheelMirror();
    function wheelMirror() {
        if (!oContainer.current) return;
        oContainer.current.addEventListener('wheel', e => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.5 : 0.5;
            scale += delta;
            if (scale < 2) scale = 2;
            if (scale > 10) scale = 10;

            Mirror(lastMouseX, lastMouseY);
        }, { passive: false });

    }

    function handleMouseLeave() {
        oMirror.style.display = 'none';
    }

    function Mirror(dis_left: number, dis_top: number) {
        if (!oContainer.current) return;
        oBigImg.style.transform = `scale(${scale})`;

        // 計算大圖與原圖的對應放大位置
        oBigImg.style.left = `${-((oBigImg.offsetWidth + window.scrollX) * scale / oContainer.current.offsetWidth * dis_left - oMirror.offsetWidth / 2)}px`;
        oBigImg.style.top = `${-((oBigImg.offsetHeight + window.scrollY) * scale / oContainer.current.offsetHeight * dis_top - oMirror.offsetHeight / 2)}px`;
    }

    let mirrorStatus = true;
    const oMirrorFC = () => {
        if (!oContainer.current) return;
        oMirror.addEventListener('click', () => {
            if (!oContainer.current) return;
            mirrorStatus === true ? oContainer.current.removeEventListener('mouseleave', handleMouseLeave) : oContainer.current.addEventListener('mouseleave', handleMouseLeave)
            mirrorStatus === true ? oContainer.current.removeEventListener('mousemove', mirrorFollow) : oContainer.current.addEventListener('mousemove', mirrorFollow)
            mirrorStatus = !mirrorStatus;
        });

        oContainer.current.addEventListener('mouseleave', handleMouseLeave);
        oContainer.current.addEventListener('mousemove', mirrorFollow);
    }
    oMirrorFC();

    // 放大鏡區------------------------------------------------|\
    return (
        <>
            {windowDisplay && (
                <>
                    <ImageEditor
                        imageData={imageData}
                        onClose={() => setimg_formation()}
                        isPublic={isPublic}
                        setIsPublic={setIsPublic} />
                </>
            )}

            <div className="all_page">
                {/* 標籤區塊 */}
                <div className="whole_img_tag">
                    <h4>人物</h4>
                    <div>
                        {imageData?.mainTag &&
                            imageData?.mainTag.map((v, index) => (
                                <div key={`${v + index}`}>
                                    <li>
                                        <TagLink type="mainTag" v={v}></TagLink>
                                        <a href="#">{imageData.tagAmount.pageMainTagAmount[index][0].count}</a>
                                        <a href="#">{imageData.tagAmount.pageMainTagAmount[index][1].count}</a>
                                        {v && <a href="#" onClick={() => window.open("", "_blank")}>🔍</a>}
                                    </li>
                                </div>
                            ))}
                    </div>

                    {/* <hr className="left-hr" /> */}
                    <h4>團體</h4>
                    <div>
                        {imageData?.secondaryTag &&
                            imageData?.secondaryTag.map((v, index) => (
                                <div key={`${v + index}`}>
                                    <li>
                                        <TagLink type="secondaryTag" v={v}></TagLink>
                                        <a href="#">{imageData.tagAmount.pageSecondaryTagAmount[index][0].count}</a>
                                        <a href="#">{imageData.tagAmount.pageSecondaryTagAmount[index][1].count}</a>
                                    </li>
                                </div>
                            ))}
                    </div>

                    {/* <hr className="left-hr" /> */}
                    <h4>作者</h4>
                    <div>
                        {imageData?.ArtistTag &&
                            imageData?.ArtistTag.map((v, index) => (
                                <div key={`${v + index}`}>
                                    <li>
                                        <TagLink type="ArtistTag" v={v}></TagLink>
                                        <a href="#">{imageData.tagAmount.pageArtistTagAmount[index][0].count}</a>
                                        <a href="#">{imageData.tagAmount.pageArtistTagAmount[index][1].count}</a>
                                    </li>
                                </div>
                            ))}
                    </div>

                    {/* <hr className="left-hr" /> */}
                    <h4>其他</h4>
                    <div>
                        {imageData?.anotherTag &&
                            imageData?.anotherTag.map((v, index) => (
                                <div key={`${v + index}`}>
                                    <li>
                                        <TagLink type="anotherTag" v={v}></TagLink>
                                        <a href="#">{imageData.tagAmount.pageAnotherTagAmount[index][0].count}</a>
                                        <a href="#">{imageData.tagAmount.pageAnotherTagAmount[index][1].count}</a>
                                    </li>
                                </div>
                            ))}
                    </div>

                    {/* <hr className="left-hr" /> */}
                    <h4>資訊</h4>
                    <div className="_tag_infomation">
                        <div className="img_path">
                            圖片位址/名稱:
                            <a
                                href={
                                    imageData?.check_img_type === "HTTP"
                                        ? imageData?.img_path
                                        : `${getFilePath(user_id, imageData?.img_path ?? '')}`
                                }
                            >
                                {imageData?.img_path}
                            </a>
                        </div>
                        <div className="update">上傳日期:{imageData?.created_at}</div>
                        <div className="update">
                            檔案大小:
                            {imageData?.check_img_type == "HTTP"
                                ? "圖片位址圖，無檔案大小"
                                : imageData?.file_size}
                        </div>
                        <div className="img_path">
                            圖源:
                            <a href={imageData?.source}>{imageData?.source}</a>
                        </div>
                    </div>

                    {/* <hr className="left-hr" /> */}
                    <h4>圖片狀態</h4>
                    <div>
                        <div>
                            <li>{isPublic ? "公開" : "私人"}</li>
                        </div>
                    </div>

                    <div className="set_row">
                        {imageData?.check_img_type !== "backGoundImage" &&
                            imageData?.check_img_type !== "Wimage" &&
                            imageData?.check_img_type !== "icon" &&
                            String(imageData?.creat_user_id) ? (
                            <>
                                <div className="edit_img_bt">
                                    <button id="setimgbt" onClick={() => setimg_formation()}>
                                        編輯
                                    </button>
                                </div>
                                <div className="delete_img_bt">
                                    <button onClick={() => deleteIMG()}>刪除</button>
                                </div>
                            </>
                        ) : null}

                        {String(imageData?.creat_user_id) !== user_id && (
                            <div className="delete_img_bt">此為使用者公開圖像，無法編輯</div>
                        )}

                        {(imageData?.check_img_type === "backGoundImage" ||
                            imageData?.check_img_type === "Wimage" ||
                            imageData?.check_img_type === "icon") &&
                            String(imageData?.creat_user_id) === user_id && (
                                <div className="delete_img_bt">此為首頁UI圖像，無法編輯</div>
                            )}
                    </div>
                    {/* 下載按鈕 */}
                    <div>
                        <a id="downLoad" style={{ color: "black" }} onClick={() => downLoad()}>
                            DownLoad
                        </a>
                    </div>
                </div>

                {/* 主圖展示 */}
                <div className="display_img">
                    <div className="whole_img" id="container" ref={oContainer}>
                        <img
                            id="whole_img"
                            ref={whole_imgRef}
                            src={
                                imageData?.check_img_type === "HTTP"
                                    ? imageData?.img_path
                                    : `${getFilePath(user_id, imageData?.img_path ?? '')}`
                            }
                            className="col-xs-12 col-sm-4 thumbnail"
                            alt="..."
                        />
                        <div id="mirror">
                            <img
                                id="zoomImg"
                                src={
                                    imageData?.check_img_type === "HTTP"
                                        ? imageData?.img_path
                                        : `${getFilePath(user_id, imageData?.img_path ?? '')}`
                                }
                                alt=""
                            />
                        </div>
                    </div>
                </div>
            </div>
        </>

    )
}
export { Image_page }