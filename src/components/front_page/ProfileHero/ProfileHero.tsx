import React, { useEffect, useRef, useState } from 'react';
import Cropper, { ReactCropperElement } from 'react-cropper';
import { fetchIcon, UploadInterfaceImage } from 'services/image.service';
import { $message, FlushLocalStrage, getFilePath } from 'utils';
import { Btn, Icon } from 'components';

interface ProfileHeroProps {
    onEditProfile: () => void;
    onUpload: () => void;
}

interface InterfaceImgData {
    files: FileList;
    InputId: string;
    ImageType: 'icon' | 'WImage';
    HTMLImgID: string;
}

// v3 profile-hero (cover wallpaper) + profile-info (avatar / name / handle / actions).
// Replaces legacy src/components/front_page/ProfileHeader (which mounted a .warning chrome).
// Cropper modal is mounted at the top of the render tree for z-index correctness.
const ProfileHero: React.FC<ProfileHeroProps> = ({ onEditProfile, onUpload }) => {
    const user_id = localStorage.getItem('user_id') ?? '0';
    const account = (() => {
        const raw = localStorage.getItem('user');
        if (!raw) return 'guest';
        try {
            return JSON.parse(raw).account ?? 'guest';
        } catch {
            return 'guest';
        }
    })();
    const initial = account.slice(0, 2).toUpperCase();

    const [wImage, setWimage] = useState<string | null>(null);
    const [icon, setIcon] = useState<string | null>(null);

    const [imageSrc, setImageSrc] = useState<string>();
    const [isVisible, setIsVisible] = useState(false);
    const [cropperShape, setCropperShape] = useState<'circle' | 'square'>('square');
    const [interfaceImgData, setInterfaceImgData] = useState<InterfaceImgData>();
    const [rotation, setRotation] = useState(0);

    const cropperRef = useRef<ReactCropperElement>(null);

    useEffect(() => {
        const cachedW = localStorage.getItem('WImage');
        if (cachedW) {
            setWimage(cachedW);
        } else if (user_id && user_id !== '0') {
            fetchIcon('check_img_type', 'Wimage', user_id)
                .then((res) => {
                    const imgPath = res?.result?.img_path;
                    if (!imgPath) { setWimage(null); return; }
                    const path = getFilePath(user_id, imgPath);
                    const img = new Image();
                    img.src = path;
                    img.onload = () => {
                        localStorage.setItem('WImage', path);
                        setWimage(path);
                    };
                    img.onerror = () => setWimage(null);
                })
                .catch(() => setWimage(null));
        }

        const cachedI = localStorage.getItem('icon');
        if (cachedI) {
            setIcon(cachedI);
        } else if (user_id && user_id !== '0') {
            fetchIcon('check_img_type', 'icon', user_id)
                .then((res) => {
                    const imgPath = res?.result?.img_path;
                    if (!imgPath) { setIcon(null); return; }
                    const path = getFilePath(user_id, imgPath);
                    const img = new Image();
                    img.src = path;
                    img.onload = () => {
                        localStorage.setItem('icon', path);
                        setIcon(path);
                    };
                    img.onerror = () => setIcon(null);
                })
                .catch(() => setIcon(null));
        }
    }, [user_id]);

    const $id = (id: string) => document.getElementById(id) as HTMLInputElement | null;

    const openEditor = (files: FileList, InputId: string, ImageType: 'icon' | 'WImage', HTMLImgID: string) => {
        setCropperShape(ImageType === 'icon' ? 'circle' : 'square');
        const reader = new FileReader();
        reader.onload = (e) => {
            if (typeof e.target?.result === 'string') setImageSrc(e.target.result);
            setInterfaceImgData({ files, InputId, ImageType, HTMLImgID });
            setIsVisible(true);
        };
        reader.readAsDataURL(files[0]);
    };

    const cropperCancel = () => {
        if (interfaceImgData?.InputId) {
            const el = $id(interfaceImgData.InputId);
            if (el) el.value = '';
        }
        setIsVisible(false);
        setImageSrc(undefined);
    };

    const autoSubmit = async (file: File) => {
        if (!interfaceImgData) return;
        const { InputId, ImageType } = interfaceImgData;
        const input = $id(InputId);
        $message('上傳中...');
        const formData = new FormData();
        formData.append(ImageType, file);
        try {
            const response = await UploadInterfaceImage(formData);
            if (response.status === 200 || response.status === 201) {
                const newPath = `${process.env.REACT_APP_IMAGE_URL}/${response.data.path.replace(/^\/?/, '')}`;
                if (ImageType === 'icon') {
                    setIcon(newPath);
                    localStorage.setItem('icon', newPath);
                } else if (ImageType === 'WImage') {
                    setWimage(newPath);
                    localStorage.setItem('WImage', newPath);
                }
                FlushLocalStrage();
                $message('上傳成功');
            }
            if (input) input.value = '';
        } catch (e) {
            $message(`上傳失敗\n${e}`, 'error');
        }
    };

    // body 全頁背景上傳 — 不走 Cropper (沿用舊 BackgroundImgUploadButton 行為，
    // 直接上傳整張圖、靠 background-size cover 自適應)。
    const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files?.length) return;
        const file = files[0];
        $message('上傳中...');
        const formData = new FormData();
        formData.append('backGoundImage', file);
        try {
            const response = await UploadInterfaceImage(formData);
            if (response.status === 200 || response.status === 201) {
                const newPath = `${process.env.REACT_APP_IMAGE_URL}/${response.data.path.replace(/^\/?/, '')}`;
                document.body.style.backgroundImage = `url(${newPath})`;
                localStorage.setItem('backGoundImage', response.data.path);
                FlushLocalStrage();
                $message('上傳成功');
            }
            e.target.value = '';
        } catch (err) {
            $message(`上傳失敗\n${err}`, 'error');
        }
    };

    const crop = () => {
        const _cropper = cropperRef.current?.cropper;
        if (!_cropper) return;
        const canvas = _cropper.getCroppedCanvas({ imageSmoothingQuality: 'high' });

        if (cropperShape === 'circle') {
            const circular = document.createElement('canvas');
            const ctx = circular.getContext('2d');
            circular.width = 300;
            circular.height = 300;
            ctx?.beginPath();
            ctx?.arc(150, 150, 150, 0, Math.PI * 2);
            ctx?.closePath();
            ctx?.clip();
            ctx?.drawImage(canvas, 0, 0, 300, 300);
            circular.toBlob((blob) => {
                if (!blob) return;
                const file = new File([blob], 'cropped_avatar.png', { type: 'image/png' });
                autoSubmit(file);
                setIsVisible(false);
            }, 'image/png', 1);
        } else {
            canvas.toBlob((blob) => {
                if (!blob) return;
                const file = new File([blob], 'cropped_wallpaper.png', { type: 'image/png' });
                autoSubmit(file);
                setIsVisible(false);
            }, 'image/png', 1);
        }
    };

    return (
        <>
            {isVisible && (
                <div className="float_window" id="cropper-img-outlay" style={{ display: 'flex' }}>
                    <div className="cropper-warapper">
                        <div className="cropper-headder">
                            <div id="cropper-cencel" onClick={cropperCancel} style={{ cursor: 'pointer' }}>×</div>
                        </div>
                        <div className="cropper-body">
                            <div className="cropper-img">
                                <div className={`cropper-container ${cropperShape === 'circle' ? 'cropper-circle' : 'cropper-square'}`}>
                                    {cropperShape === 'circle' ? (
                                        <Cropper
                                            src={imageSrc}
                                            style={{ height: 500, width: 500 }}
                                            aspectRatio={1}
                                            viewMode={3}
                                            dragMode="move"
                                            cropBoxResizable={false}
                                            background={false}
                                            guides
                                            wheelZoomRatio={0.1}
                                            minCanvasWidth={500}
                                            minCanvasHeight={500}
                                            autoCropArea={1}
                                            responsive
                                            ref={cropperRef}
                                            rotatable
                                        />
                                    ) : (
                                        <Cropper
                                            src={imageSrc}
                                            style={{ height: 500, width: 500 }}
                                            aspectRatio={4}
                                            viewMode={1}
                                            dragMode="move"
                                            cropBoxResizable={false}
                                            background={false}
                                            guides
                                            wheelZoomRatio={0.1}
                                            cropBoxMovable={false}
                                            autoCropArea={1}
                                            responsive
                                            ref={cropperRef}
                                            rotatable
                                        />
                                    )}
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
                                    cropperRef.current?.cropper.rotateTo(angle);
                                }}
                            />
                            <button id="crop-reset" onClick={() => { cropperRef.current?.cropper.reset(); setRotation(0); }}>重製</button>
                            <button onClick={crop} id="crop">確定</button>
                        </div>
                    </div>
                </div>
            )}

            <div
                className="profile-hero"
                style={wImage ? { backgroundImage: `url(${wImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
                <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 8, zIndex: 2 }}>
                    <Btn
                        variant="ghost"
                        size="sm"
                        icon={<Icon.image size={12} />}
                        onClick={() => $id('bg_input')?.click()}
                    >
                        更換背景
                    </Btn>
                    <Btn
                        variant="ghost"
                        size="sm"
                        icon={<Icon.edit size={12} />}
                        onClick={() => $id('wimg')?.click()}
                    >
                        編輯封面
                    </Btn>
                </div>
                <input
                    type="file"
                    id="wimg"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        if (!e.target.files?.length) return;
                        openEditor(e.target.files, 'wimg', 'WImage', 'W_Image');
                    }}
                />
                <input
                    type="file"
                    id="bg_input"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleBgUpload}
                />
            </div>
            <div className="profile-info">
                <div
                    className="big-avatar"
                    style={icon
                        ? { backgroundImage: `url(${icon})`, backgroundSize: 'cover', backgroundPosition: 'center', cursor: 'pointer' }
                        : { cursor: 'pointer' }}
                    onClick={() => $id('icon_input')?.click()}
                    title="點擊上傳頭像"
                >
                    {!icon && initial}
                </div>
                <input
                    type="file"
                    id="icon_input"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        if (!e.target.files?.length) return;
                        openEditor(e.target.files, 'icon_input', 'icon', 'ICON_Image');
                    }}
                />
                <div className="profile-meta">
                    <h1 className="profile-name">
                        {account}
                        <span className="verified"><Icon.check size={11} /></span>
                    </h1>
                    <p className="profile-handle">@{account} · Pro 會員</p>
                </div>
                <div className="profile-actions">
                    <Btn variant="secondary" size="sm" icon={<Icon.edit size={12} />} onClick={onEditProfile}>
                        編輯資料
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={onUpload}>
                        上傳圖片
                    </Btn>
                </div>
            </div>
        </>
    );
};

export { ProfileHero };
