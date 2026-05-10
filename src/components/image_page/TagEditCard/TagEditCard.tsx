import React from 'react';
import { Data, Icon, TagInput } from 'components';
import { _dynamictagtype } from 'utils';

interface TagEditCardProps {
    imageData: Data | undefined;
    mainTag: string;
    secondaryTag: string;
    ArtistTag: string;
    anotherTag: string;
    source: string;
    isPublic: boolean;
    onMainTagChange: (v: string) => void;
    onSecondaryTagChange: (v: string) => void;
    onArtistTagChange: (v: string) => void;
    onAnotherTagChange: (v: string) => void;
    onSourceChange: (v: string) => void;
    onPublicToggle: () => void;
}

// 右側「編輯標籤」card — isPublic toggle + 4 個 tag (TagInput) + source
const TagEditCard: React.FC<TagEditCardProps> = ({
    imageData,
    mainTag, secondaryTag, ArtistTag, anotherTag, source, isPublic,
    onMainTagChange, onSecondaryTagChange, onArtistTagChange, onAnotherTagChange, onSourceChange, onPublicToggle,
}) => {
    const mainAllTags = { '人物': imageData?.mainTags?.map((t) => t.tag_name) ?? [] };
    const secondaryAllTags = { '團體': imageData?.secondaryTags?.map((t) => t.tag_name) ?? [] };
    const artistAllTags = { '作者': imageData?.artistTags?.map((t) => t.tag_name) ?? [] };
    const anotherAllTags = (() => {
        const grouped = _dynamictagtype(imageData?.tagsGroup ?? []) as Record<string, Array<{ tag_name: string }>> | undefined;
        if (!grouped) return { '其他': [] };
        return Object.fromEntries(
            Object.entries(grouped).map(([k, arr]) => [k || '未分類', arr.map((t) => t.tag_name)])
        );
    })();

    return (
        <div className="card tag-edit-card">
            <div className="toggle-row" style={{ marginBottom: 4 }}>
                <div className="text">
                    <span className="lbl">
                        {isPublic ? <Icon.globe size={13} /> : <Icon.lock size={13} />}
                        {' '}{isPublic ? '公開' : '私人'}
                    </span>
                    <span className="sub">{isPublic ? '所有人可見' : '只有你看得到'}</span>
                </div>
                <div
                    className={`toggle ${isPublic ? 'on' : ''}`}
                    onClick={onPublicToggle}
                    role="switch"
                    aria-checked={isPublic}
                />
            </div>

            <div className="tag-edit-section">
                <div className="head">
                    <span className="lbl">人物 mainTag</span>
                    <span className="ct">{mainTag.split(',').filter(Boolean).length}</span>
                </div>
                <TagInput allTags={mainAllTags} value={mainTag} name="mainTag" onChange={onMainTagChange} placeholder="人物標籤,逗號分隔" />
            </div>

            <div className="tag-edit-section">
                <div className="head">
                    <span className="lbl">團體 secondaryTag</span>
                    <span className="ct">{secondaryTag.split(',').filter(Boolean).length}</span>
                </div>
                <TagInput allTags={secondaryAllTags} value={secondaryTag} name="secondaryTag" onChange={onSecondaryTagChange} placeholder="團體標籤,逗號分隔" />
            </div>

            <div className="tag-edit-section">
                <div className="head">
                    <span className="lbl">作者 ArtistTag</span>
                    <span className="ct">{ArtistTag.split(',').filter(Boolean).length}</span>
                </div>
                <TagInput allTags={artistAllTags} value={ArtistTag} name="ArtistTag" onChange={onArtistTagChange} placeholder="作者,逗號分隔" />
            </div>

            <div className="tag-edit-section">
                <div className="head">
                    <span className="lbl">其他 anotherTag</span>
                    <span className="ct">{anotherTag.split(',').filter(Boolean).length}</span>
                </div>
                <TagInput allTags={anotherAllTags} value={anotherTag} name="anotherTag" isTextarea onChange={onAnotherTagChange} placeholder="金髮, 黑絲, 藍瞳, ..." />
            </div>

            <div className="tag-edit-section">
                <div className="head">
                    <span className="lbl">圖源 source</span>
                </div>
                <input className="input" value={source} onChange={(e) => onSourceChange(e.target.value)} placeholder="https://..." />
            </div>
        </div>
    );
};

export { TagEditCard };
