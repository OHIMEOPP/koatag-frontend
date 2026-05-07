import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImageData } from 'components/types/images';
import { Icon } from 'components';
import { getFilePath } from 'utils';

interface ImageCardProps {
    image: ImageData;
    editMode: boolean;
}

// v3 .img-card 結構 — prop 仍 { image: ImageData, editMode } 不採 redesign 的
// ImageItem shape (per project memory constraint)。
// pills 顯示真實 tag count + is_public icon。fav 視覺保留但點擊 placeholder
// (favorites 後端零基礎)。
const ImageCard: React.FC<ImageCardProps> = ({ image, editMode }) => {
    const user_id = localStorage.getItem('user_id') ?? '0';
    const navigate = useNavigate();
    const [check, setCheck] = useState(false);
    const [imgError, setImgError] = useState(false);

    const tagCount =
        (image.mainTag?.length ?? 0) +
        (image.secondaryTag?.length ?? 0) +
        (image.ArtistTag?.length ?? 0) +
        (image.anotherTag?.length ?? 0);

    // NodeRED `getImage` 回傳 is_public 是字串 'public' / 'private' (verified 2026-05-02
    // via debug log). 兼容也接受 truthy 數字/布林避免後端 contract 微改時炸。
    const publicRaw = image.is_public as unknown;
    const isPublic = publicRaw === 'public' || publicRaw === '1' || publicRaw === 1 || publicRaw === true;

    const imgSrc = image.thumb_path
        ? getFilePath(user_id, image.thumb_path)
        : image.check_img_type === 'HTTP'
            ? image.img_path
            : getFilePath(user_id, image.img_path);
    const filename = (image.img_path?.split('/').pop() ?? '').replace(/\.[^/.]+$/, '') || `image-${image.id}`;

    const handleClick = () => {
        if (editMode) {
            setCheck((c) => !c);
        } else {
            navigate(`/main/image_page?img_id=${image.id}`);
        }
    };

    const handleFav = (e: React.MouseEvent) => {
        e.stopPropagation();
        alert('收藏功能尚未開放');
    };

    return (
        <div
            className="img-card"
            onClick={handleClick}
            style={editMode && check ? { borderColor: 'var(--color-primary)', boxShadow: '0 0 0 2px var(--color-primary-glow)' } : undefined}
        >
            {imgError ? (
                <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--color-text-quaternary)', fontSize: 12, background: 'var(--color-bg-tertiary)' }}>
                    無圖片
                </div>
            ) : (
                <>
                    <div className="img-thumb" style={{ backgroundImage: `url(${imgSrc})` }} />
                    {/* hidden img for onError detection (background-image silently fails) */}
                    <img src={imgSrc} alt="" style={{ display: 'none' }} onError={() => setImgError(true)} />
                </>
            )}
            <div className="img-overlay" />
            <div className="img-top">
                <span className="img-pill gold" data-tooltip-content={`共 ${tagCount} 個標籤`} data-tooltip-id="tooltip">
                    <Icon.tag size={11} />
                    {tagCount}
                </span>
                <span className="img-pill" data-tooltip-content={isPublic ? '公開' : '私人'} data-tooltip-id="tooltip">
                    {isPublic ? <Icon.globe size={11} /> : <Icon.lock size={11} />}
                </span>
            </div>
            <div className="img-bot">
                <span className="name">{filename}</span>
                <button className="img-fav" onClick={handleFav} aria-label="收藏">
                    <Icon.heart size={12} />
                </button>
            </div>
            {editMode && (
                <input
                    type="checkbox"
                    id={String(image.id)}
                    name="imagesId"
                    checked={check}
                    onChange={(e) => { e.stopPropagation(); setCheck(e.target.checked); }}
                    onClick={(e) => e.stopPropagation()}
                    style={{ position: 'absolute', top: 8, right: 8, zIndex: 3, accentColor: 'var(--color-primary)' }}
                />
            )}
        </div>
    );
};

export { ImageCard };
