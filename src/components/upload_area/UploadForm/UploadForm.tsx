import React from 'react';
import { Data, Field, Icon, TagInput } from 'components';
import { _dynamictagtype } from 'utils';

interface UploadFormProps {
    uploadAreaInfo: Data | undefined;
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

// Upload page 的右側 form — 4 個 TagInput + source + isPublic toggle
const UploadForm: React.FC<UploadFormProps> = ({
    uploadAreaInfo,
    mainTag, secondaryTag, ArtistTag, anotherTag, source, isPublic,
    onMainTagChange, onSecondaryTagChange, onArtistTagChange, onAnotherTagChange, onSourceChange, onPublicToggle,
}) => {
    const anotherAllTags = (() => {
        const grouped = _dynamictagtype(uploadAreaInfo?.tagsGroup ?? []) as Record<string, Array<{ tag_name: string }>> | undefined;
        if (!grouped) return { '其他': [] };
        return Object.fromEntries(
            Object.entries(grouped).map(([k, arr]) => [k || '未分類', arr.map((t) => t.tag_name)])
        );
    })();

    return (
        <div className="card upload-form">
            <h3>圖片資訊</h3>

            <Field label="人物 (main tag)" hint="多個用半形逗號分隔">
                <TagInput
                    allTags={{ '人物': uploadAreaInfo?.mainTags?.map((t) => t.tag_name) ?? [] }}
                    value={mainTag}
                    name="mainTag"
                    onChange={onMainTagChange}
                    placeholder="輸入人物標籤"
                />
            </Field>

            <Field label="團體 (second tag)" hint="多個用半形逗號分隔">
                <TagInput
                    allTags={{ '團體': uploadAreaInfo?.secondaryTags?.map((t) => t.tag_name) ?? [] }}
                    value={secondaryTag}
                    name="secondaryTag"
                    onChange={onSecondaryTagChange}
                    placeholder="輸入團體標籤"
                />
            </Field>

            <Field label="作者 (artist tag)" hint="多個用半形逗號分隔">
                <TagInput
                    allTags={{ '作者': uploadAreaInfo?.artistTags?.map((t) => t.tag_name) ?? [] }}
                    value={ArtistTag}
                    name="ArtistTag"
                    onChange={onArtistTagChange}
                    placeholder="輸入作者"
                />
            </Field>

            <Field label="其他標籤 (another tag)" hint="自定 type 自動分組顯示">
                <TagInput
                    allTags={anotherAllTags}
                    value={anotherTag}
                    name="anotherTag"
                    isTextarea
                    onChange={onAnotherTagChange}
                    placeholder="金髮, 黑絲, 藍瞳, ..."
                />
            </Field>

            <Field label="圖源 (source URL)" hint="可貼來源網址">
                <input
                    className="input"
                    placeholder="https://..."
                    value={source}
                    onChange={(e) => onSourceChange(e.target.value)}
                />
            </Field>

            <div className="toggle-row">
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
        </div>
    );
};

export { UploadForm };
