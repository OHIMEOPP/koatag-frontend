import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    Btn, Data, Icon,
    DetailStage, TagEditCard, SideInfoCards, AiSuggestionCard,
} from 'components';
import { getImagePageInfo, update } from 'services/pageInfo/image_page.service';
import { parser, getFilePath, $message } from 'utils';

// 把 incoming tag list merge 進現有逗號分隔字串 (Set dedupe + 保留 user 輸入)
const mergeTags = (existing: string, incoming: string[]): string => {
    const set = new Set(existing.split(',').map((t) => t.trim()).filter(Boolean));
    incoming.forEach((t) => {
        const trimmed = (t ?? '').trim();
        if (trimmed) set.add(trimmed);
    });
    return Array.from(set).join(',');
};

const Image_page = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user_id = localStorage.getItem('user_id') ?? '0';
    const urlParams = new URLSearchParams(location.search);
    const img_id = urlParams.get('img_id');

    const [imageData, setImageData] = useState<Data | undefined>();
    const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
    const [sideMode, setSideMode] = useState<'info' | 'edit'>('info');

    // Tag editor state — 從 imageData.O*Tag 初始化
    const [mainTag, setMainTag] = useState('');
    const [secondaryTag, setSecondaryTag] = useState('');
    const [ArtistTag, setArtistTag] = useState('');
    const [anotherTag, setAnotherTag] = useState('');
    const [source, setSource] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!img_id) return;
        getImagePageInfo(img_id)
            .then((res) => {
                if (!res) return;
                const parsed = parser(res);
                setImageData(parsed.result);
            })
            .catch((e) => console.error('getImagePageInfo failed', e));
    }, [img_id]);

    useEffect(() => {
        if (!imageData) return;
        setMainTag(imageData.OmainTag ?? '');
        setSecondaryTag(imageData.OsecondaryTag ?? '');
        setArtistTag(imageData.OArtistTag ?? '');
        setAnotherTag(imageData.OanotherTag ?? '');
        setSource(imageData.source ?? '');
        setIsPublic(imageData.is_public === 'public');
    }, [imageData]);

    if (!img_id) {
        return (
            <div className="page">
                <div className="card" style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                    缺少 img_id 參數
                </div>
            </div>
        );
    }

    const imgSrc = imageData?.check_img_type === 'HTTP'
        ? imageData.img_path
        : getFilePath(user_id, imageData?.img_path ?? '');

    // Dirty 偵測 — 用來控制儲存 btn 的 tooltip 提示
    const hasChanges = imageData ? (
        mainTag !== (imageData.OmainTag ?? '') ||
        secondaryTag !== (imageData.OsecondaryTag ?? '') ||
        ArtistTag !== (imageData.OArtistTag ?? '') ||
        anotherTag !== (imageData.OanotherTag ?? '') ||
        source !== (imageData.source ?? '') ||
        isPublic !== (imageData.is_public === 'public')
    ) : false;

    const handleSave = async () => {
        if (!img_id) return;
        const formData = new FormData();
        if (mainTag.trim())      formData.append('mainTag', mainTag.trim());
        if (secondaryTag.trim()) formData.append('secondaryTag', secondaryTag.trim());
        if (ArtistTag.trim())    formData.append('ArtistTag', ArtistTag.trim());
        if (anotherTag.trim())   formData.append('anotherTag', anotherTag.trim());
        if (source.trim())       formData.append('source', source.trim());
        if (isPublic) formData.append('isPublic', '1');

        setSubmitting(true);
        $message('儲存中…');
        try {
            // koatag 確認: status 永遠 1 不論成敗, 看 HTTP code 判. axios 在 HTTP >= 400 throw,
            // 所以進 try 就是 200 成功.
            const response = await update(formData, img_id);
            $message(response?.message ?? '更新成功');
            // 重抓 imageData 同步 (重置 dirty + tagAmount 反映新 tag)
            const refreshed = await getImagePageInfo(img_id);
            if (refreshed) {
                const parsed = parser(refreshed);
                setImageData(parsed.result);
            }
        } catch (err) {
            console.error('updateImageData failed', err);
            $message('儲存失敗，請稍後再試', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownload = () => {
        if (!imageData) return;
        const filename = imageData.img_path?.split('/').pop() ?? 'download.png';
        const link = document.createElement('a');
        link.href = imgSrc;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDelete = () => {
        alert('刪除功能尚未開放 (等 Step 12 後端 endpoint)');
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <Btn variant="ghost" size="sm" icon={<Icon.chevronLeft size={12} />} onClick={() => navigate(-1)}>
                        返回
                    </Btn>
                    <h1 className="t-h1 page-title" style={{ marginTop: 8 }}>圖片詳情</h1>
                    <p className="page-sub">
                        {imageData
                            ? `#${imageData.id} · 上傳於 ${imageData.created_at?.slice(0, 10) ?? '?'}`
                            : '載入中…'}
                    </p>
                </div>
                <div className="v-row v-gap-2">
                    <div style={{ display: 'flex', gap: 4 }}>
                        <button
                            type="button"
                            onClick={() => setSideMode('info')}
                            style={{
                                padding: '7px 14px', background: 'transparent', border: 'none',
                                borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 500,
                                cursor: 'pointer', transition: 'color var(--transition-fast)',
                                color: sideMode === 'info' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            }}
                        >
                            檔案資訊
                        </button>
                        <button
                            type="button"
                            onClick={() => setSideMode('edit')}
                            style={{
                                padding: '7px 14px', background: 'transparent', border: 'none',
                                borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 500,
                                cursor: 'pointer', transition: 'color var(--transition-fast)',
                                color: sideMode === 'edit' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            }}
                        >
                            編輯標籤
                        </button>
                    </div>
                    <Btn variant="ghost" size="sm" icon={<Icon.download size={12} />} onClick={handleDownload} disabled={!imageData}>
                        下載
                    </Btn>
                    <Btn variant="ghost" size="sm" icon={<Icon.trash size={12} />} onClick={handleDelete}>
                        刪除
                    </Btn>
                    <Btn
                        variant="primary"
                        size="sm"
                        icon={<Icon.check size={12} />}
                        disabled={sideMode === 'info' || submitting}
                        title={sideMode === 'info' ? '切到「編輯標籤」才能修改' : (hasChanges ? '送出變更' : '尚未變動 (仍可送)')}
                        onClick={handleSave}
                    >
                        {submitting ? '儲存中…' : '儲存變更'}
                    </Btn>
                </div>
            </div>

            <div className="detail-grid">
                {imageData && (
                    <DetailStage
                        imgSrc={imgSrc}
                        alt={imageData.img_path}
                        onNaturalDimsLoad={setNaturalDims}
                    />
                )}

                <div className="detail-side">
                    {sideMode === 'edit' && (
                        <TagEditCard
                            imageData={imageData}
                            mainTag={mainTag}
                            secondaryTag={secondaryTag}
                            ArtistTag={ArtistTag}
                            anotherTag={anotherTag}
                            source={source}
                            isPublic={isPublic}
                            onMainTagChange={setMainTag}
                            onSecondaryTagChange={setSecondaryTag}
                            onArtistTagChange={setArtistTag}
                            onAnotherTagChange={setAnotherTag}
                            onSourceChange={setSource}
                            onPublicToggle={() => setIsPublic((p) => !p)}
                        />
                    )}

                    {sideMode === 'info' && imageData && (
                        <SideInfoCards imageData={imageData} naturalDims={naturalDims} />
                    )}

                    {sideMode === 'edit' && (
                        <AiSuggestionCard
                            imageData={imageData}
                            onMergeMainTag={(incoming) => setMainTag((prev) => mergeTags(prev, incoming))}
                            onMergeSecondaryTag={(incoming) => setSecondaryTag((prev) => mergeTags(prev, incoming))}
                            onMergeAnotherTag={(incoming) => setAnotherTag((prev) => mergeTags(prev, incoming))}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export { Image_page };
