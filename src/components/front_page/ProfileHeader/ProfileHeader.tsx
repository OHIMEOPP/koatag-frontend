
import Cropper from "react-cropper";
import { useEffect, useRef, useState } from "react";
import { ReactCropperElement } from "react-cropper";
import { fetchIcon, UploadInterfaceImage } from "services/image.service";
import { $message, FlushLocalStrage, getFilePath } from "utils";

import "../../../style/front_page/ProfileHeader/ProfileHeader.scss"

interface InterfaceImgData {
    files: FileList;
    InputId: string;
    ImageType: string;
    HTMLImgID: string
}

const ProfileHeader = () => {
    const [rotation, setRotation] = useState(0);
    const user_id = String(window.user_id);
    useEffect(() => {
        // 第二步：等 cookie 設好了再讀取 token 並打 API
        const wImage = localStorage.getItem('WImage');
        const icon = localStorage.getItem('icon');

        if (!wImage) {
            if (!user_id) return;
            fetchIcon('check_img_type', 'Wimage', user_id)
                .then(response => {
                    const wImage = new Image();
                    wImage.src = getFilePath(user_id, response.result.img_path);
                    wImage.onload = () => {
                        localStorage.setItem('WImage', getFilePath(user_id, response.result.img_path));
                        setWimage(getFilePath(user_id, response.result.img_path));
                    }
                })
                .catch(() => {
                })
        }
        else {
            setWimage(wImage);
        }

        if (!icon) {
            if (!user_id) return;
            fetchIcon('check_img_type', 'icon', user_id)
                .then(response => {
                    const icon = new Image();
                    icon.src = getFilePath(user_id, response.result.img_path ?? '');
                    icon.onload = () => {
                        localStorage.setItem('icon', getFilePath(user_id, response.result.img_path))
                        setIcon(getFilePath(user_id, response.result.img_path));
                    }
                })
                .catch(() => {
                })
        }
        else {
            setIcon(icon);
        }

    }, [user_id]);

    const [wimage, setWimage] = useState('');
    const [icon, setIcon] = useState('');
    const [cropperShape, setCropperShape] = useState('')

    const $id = (id: string) => document.getElementById(id) as HTMLInputElement;
    const cropperRef = useRef<ReactCropperElement>(null);
    const [imageSrc, setImageSrc] = useState<string>();
    const [isVisible, setIsVisible] = useState(false);
    const [interfaceImgData, setInterfaceImgData] = useState<InterfaceImgData>();

    function openEditor(files: FileList, InputId: string, ImageType: string, HTMLImgID: string) {
        const reader = new FileReader();
        ImageType === 'icon' ? setCropperShape('circle') : setCropperShape('square');
        reader.onload = (e) => {
            if (typeof e.target?.result === "string") {
                setImageSrc(e.target.result);
            }
            const _interfaceImgData = {
                files: files,
                InputId: InputId,
                ImageType: ImageType,
                HTMLImgID: HTMLImgID
            }
            setInterfaceImgData(_interfaceImgData)
            // 可刪
            setIsVisible(true);
        };
        reader.readAsDataURL(files[0]);
    }
    function crop() {
        const _cropper = cropperRef.current?.cropper;
        if (!_cropper) return;

        const canvas = _cropper.getCroppedCanvas({
            imageSmoothingQuality: "high",
        });
        const circular = document.createElement("canvas");
        if (cropperShape === 'circle') {

            const ctx = circular.getContext("2d");
            circular.width = 300;
            circular.height = 300;
            ctx?.beginPath();
            ctx?.arc(150, 150, 150, 0, Math.PI * 2);
            ctx?.closePath();
            ctx?.clip();
            ctx?.drawImage(canvas, 0, 0, 300, 300);

            circular.toBlob((blob) => {
                if (!blob) return;

                // 建立 File，名字隨你改
                const file = new File([blob], "cropped_avatar.png", { type: "image/png" });

                // 送出檔案
                autoSubmit(file);

                // 收起編輯器
                setIsVisible(false);
            }, "image/png", 1);
        } else {
            // 方形直接用 cropper 輸出的 canvas
            canvas.toBlob((blob) => {
                if (!blob) return;
                const file = new File([blob], "cropped_avatar.png", { type: "image/png" });
                autoSubmit(file);
                setIsVisible(false);
            }, "image/png", 1);
        }
    }
    let InputId = interfaceImgData?.InputId;
    let ImageType = interfaceImgData?.ImageType;
    let HTMLImgID = interfaceImgData?.HTMLImgID;
    useEffect(() => {
        InputId = interfaceImgData?.InputId;
        ImageType = interfaceImgData?.ImageType;
        HTMLImgID = interfaceImgData?.HTMLImgID;
    }, [interfaceImgData])
    function cropperCancel() {
        if (!InputId) return;
        const input = $id(InputId)
        input.value = ""
        setIsVisible(false);
        setImageSrc(undefined);
    }
    async function autoSubmit(file: File) {
        // const files = interfaceImgData?.files;

        if (!InputId || !ImageType) return;
        const input = $id(InputId)
        $message('上傳中...');

        if (file) {
            // console.log('檔案大小:', file.size);
            const formData = new FormData();
            formData.append(ImageType, file)
            try {
                // console.log('上傳至frontpage_controller 做圖片檔案移動 與 更新DB');
                const response = await UploadInterfaceImage(formData)

                if (response.status === 200 || response.status === 201) {
                    URL.createObjectURL(file);
                    if (ImageType === 'icon') {
                        const img = document.querySelector(`#${HTMLImgID}`) as HTMLImageElement;
                        img.src = `${process.env.REACT_APP_IMAGE_URL}/${response.data.path.replace(/^\/?/, '')}`;
                    }
                    if (ImageType === 'backGoundImage') {
                        const body = document.querySelector('body')
                        if (!body) return;
                        body.style.backgroundImage = `url(${process.env.REACT_APP_IMAGE_URL}/${response.data.path})`;
                    }
                    if (ImageType === 'WImage') {
                        const warning = document.querySelector('#warning') as HTMLDivElement;
                        warning.style.backgroundImage = `url(${process.env.REACT_APP_IMAGE_URL}/${response.data.path})`;
                    }
                    FlushLocalStrage()
                    $message('上傳成功');
                }
                input.value = "";
            } catch (error) {
                // console.log('上傳失敗', error);
                $message(`上傳失敗\n${error} `, 'error')
            }
        } else {
        }
    }
    return (
        <>
            {isVisible && (
                <div className="float_window" id="cropper-img-outlay" style={{ display: "flex" }}>
                    <div className="cropper-warapper">
                        <div className="cropper-headder">
                            <div id="cropper-cencel" onClick={() => cropperCancel()} style={{ cursor: "pointer" }}>
                                ×
                            </div>
                        </div>
                        <div className="cropper-body">
                            <div className="cropper-img" >
                                <div className={`cropper-container ${cropperShape === 'circle' ? 'cropper-circle' : 'cropper-square'}`}>
                                    {cropperShape === 'circle' && <Cropper
                                        src={imageSrc}
                                        style={{ height: "500px", width: "500px" }}
                                        aspectRatio={1}
                                        viewMode={3}
                                        dragMode="move"
                                        cropBoxResizable={false}
                                        background={false}
                                        guides={true}
                                        wheelZoomRatio={0.1} // 滾輪縮放速度
                                        minCanvasWidth={500} // 圖片最小寬度
                                        minCanvasHeight={500} // 圖片最小高度
                                        // cropBoxMovable={false}
                                        autoCropArea={1}
                                        responsive={true}
                                        ref={cropperRef}
                                        rotatable={true}
                                    />}
                                    {
                                        cropperShape === 'square' && <Cropper
                                            src={imageSrc}
                                            style={{ height: "500px", width: "500px" }}
                                            aspectRatio={4}
                                            viewMode={1}
                                            dragMode="move"
                                            cropBoxResizable={false}
                                            background={false}
                                            guides={true}
                                            wheelZoomRatio={0.1} // 滾輪縮放速度
                                            cropBoxMovable={false}
                                            autoCropArea={1}
                                            responsive={true}
                                            ref={cropperRef}
                                            rotatable={true}
                                        />
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="cropper-footer">
                            <input
                                type="range"
                                min={-180}
                                max={180}
                                step={1}
                                value={rotation}
                                onChange={(e) => {
                                    const angle = parseInt(e.target.value, 10);
                                    setRotation(angle);
                                    cropperRef.current?.cropper.rotateTo(angle); // 設定旋轉角度
                                }}
                            />
                            <button id="crop-reset" onClick={() => {
                                cropperRef.current?.cropper.reset();
                                setRotation(0);
                            }}>
                                重製
                            </button>
                            <button onClick={crop} id="crop">
                                確定
                            </button>
                        </div>
                    </div>
                </div>
            )}
            <div className="warning_out">
                <div className="warning" id='warning'
                    style={{ backgroundImage: `url(${wimage})` }}>
                    <div className="warningIMG">
                        <div className="readwarningBG" id="wBG">
                            <form className="wfrom" id="wform" method="post" encType="multipart/form-data">
                                <label htmlFor="wimg">
                                    {/* <!-- 上傳圖片按鈕的圖片 --> */}
                                    <img src="/uploadIMG.png" width="25" height="25" />
                                </label>
                                <input type="file" id="wimg" onChange={(e) => {
                                    if (!e.target.files || e.target.files.length === 0) return;
                                    openEditor(e.target.files, 'wimg', 'WImage', 'W_Image');
                                }} accept="image/*" name="Wimage" style={{ display: 'none' }} />
                            </form>
                        </div>
                        <button onClick={() => FlushLocalStrage()}>重新整理</button>
                    </div>
                    <div className="warningicon_out">
                        <div className="warningicon">
                            <form className="icon_from" id="icon_from" method="post" encType="multipart/form-data">
                                <input type="file" id="icon_input" onChange={(e) => {
                                    if (!e.target.files || e.target.files.length === 0) return;
                                    openEditor(e.target.files, 'icon_input', 'icon', 'ICON_Image');
                                }} accept="image/*" name="icon" style={{ display: 'none' }} />
                                <label htmlFor="icon_input">
                                    {/* <!-- 上傳圖片按鈕的圖片 --> */}
                                    <img id="ICON_Image"
                                        src={icon} />
                                </label>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </>
    )

}
export { ProfileHeader }