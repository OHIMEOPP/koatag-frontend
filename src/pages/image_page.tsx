import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Btn, Field, Icon, Data, Magnifier, TagInput } from 'components';
import { getImagePageInfo, update } from 'services/pageInfo/image_page.service';
import { parser, getFilePath, _dynamictagtype, $message } from 'utils';

// Step 9.2 — v3 layout shell only.
// Stage 顯示原圖 (無 Magnifier yet, 等 9.3 + 9.3.5)
// Side cards 都 placeholder, 等 9.4-9.6 接入
const Image_page = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const user_id = localStorage.getItem('user_id') ?? '0';
    const urlParams = new URLSearchParams(location.search);
    const img_id = urlParams.get('img_id');

    const [imageData, setImageData] = useState<Data | undefined>();
    const [zoom, setZoom] = useState(100);
    const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
    const [mirrorSize, setMirrorSize] = useState(200);

    // Tag editor state — 從 imageData.O*Tag (原始字串值) 初始化
    const [mainTag, setMainTag] = useState('');
    const [secondaryTag, setSecondaryTag] = useState('');
    const [ArtistTag, setArtistTag] = useState('');
    const [anotherTag, setAnotherTag] = useState('');
    const [source, setSource] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    // 右側檢視模式切換 (避免版面太長, 預設 info 模式只看資訊)
    const [sideMode, setSideMode] = useState<'info' | 'edit'>('info');

    // AI 辨識 loading state
    const [isAiLoading, setIsAiLoading] = useState(false);

    // 把 AI 回傳的 tag list 合進現有字串 (set dedupe + 保留 user 輸入)
    const mergeTags = (existing: string, incoming: string[]): string => {
        const set = new Set(existing.split(',').map((t) => t.trim()).filter(Boolean));
        incoming.forEach((t) => {
            const trimmed = (t ?? '').trim();
            if (trimmed) set.add(trimmed);
        });
        return Array.from(set).join(',');
    };

    const handleAiTag = async () => {
        if (!imageData) return;
        setIsAiLoading(true);
        $message('AI 辨識中…');

        const isHttp = imageData.check_img_type === 'HTTP'
            || imageData.img_path?.startsWith('http://')
            || imageData.img_path?.startsWith('https://');
        const aiSrc = isHttp ? imageData.img_path : getFilePath(user_id, imageData.img_path ?? '');
        if (!aiSrc) { setIsAiLoading(false); return; }

        const isCrossOrigin = aiSrc.startsWith('http://') || aiSrc.startsWith('https://');

        try {
            let response: Response;
            if (isCrossOrigin) {
                // cross-origin: 傳 URL 給 AI 服務 (它自己 fetch, 避免瀏覽器 CORS)
                response = await fetch(`${process.env.REACT_APP_AI_API_URL}/upload_by_url`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: aiSrc, translate_to_zh: true }),
                });
            } else {
                // same-origin: fetch blob 上傳
                const blob = await fetch(aiSrc).then((r) => r.blob());
                const formData = new FormData();
                formData.append('file', blob, 'image.jpg');
                response = await fetch(`${process.env.REACT_APP_AI_API_URL}/upload`, {
                    method: 'POST',
                    body: formData,
                });
            }
            const result = await response.json();

            // 人物 (mainTag) ← character_res_zh keys
            const mainNames = Object.keys(result?.character_res_zh ?? {});
            if (mainNames.length) setMainTag((prev) => mergeTags(prev, mainNames));

            // 團體 (secondaryTag) ← character_res key 中括號內的作品名
            const copyrights = Object.keys(result?.character_res ?? {})
                .map((k: string) => {
                    const m = k.match(/\(([^)]+)\)/);
                    return m ? m[1] : '';
                })
                .filter(Boolean);
            if (copyrights.length) setSecondaryTag((prev) => mergeTags(prev, copyrights));

            // 其他 (anotherTag) ← sorted_general_strings_zh
            const generalsZh = String(result?.sorted_general_strings_zh ?? '')
                .split(',').map((t: string) => t.trim()).filter(Boolean);
            if (generalsZh.length) setAnotherTag((prev) => mergeTags(prev, generalsZh));

            $message('AI 辨識完成 — 已合併到對應欄位 (作者欄需手填)');
        } catch (err) {
            console.error('AI 辨識失敗:', err);
            $message('AI 辨識失敗', 'error');
        } finally {
            setIsAiLoading(false);
        }
    };

    // Dirty 偵測 — 任一欄位跟 imageData 初始值不同就算 hasChanges, 用來控制儲存 btn enabled
    const hasChanges = imageData ? (
        mainTag !== (imageData.OmainTag ?? '') ||
        secondaryTag !== (imageData.OsecondaryTag ?? '') ||
        ArtistTag !== (imageData.OArtistTag ?? '') ||
        anotherTag !== (imageData.OanotherTag ?? '') ||
        source !== (imageData.source ?? '') ||
        isPublic !== (imageData.is_public === 'public')
    ) : false;

    // ====== 9.7 actions: save / download / delete ======
    const handleSave = async () => {
        if (!img_id) return;
        const formData = new FormData();
        // 4 個 tag 字串 (空值省略, 後端會解讀為 [] 清空 OR 不變看 controller, 保守只送有值)
        if (mainTag.trim())      formData.append('mainTag', mainTag.trim());
        if (secondaryTag.trim()) formData.append('secondaryTag', secondaryTag.trim());
        if (ArtistTag.trim())    formData.append('ArtistTag', ArtistTag.trim());
        if (anotherTag.trim())   formData.append('anotherTag', anotherTag.trim());
        if (source.trim())       formData.append('source', source.trim());
        // isPublic 只 truthy 才送 (對齊 koatag 修好的 backend `?` 邏輯)
        if (isPublic) formData.append('isPublic', '1');

        setSubmitting(true);
        $message('儲存中…');
        try {
            // koatag 確認: status 永遠 1 不論成敗, 看 HTTP code 判. axios 會在 HTTP >= 400
            // throw, 所以進 try 就是 200 成功.
            const response = await update(formData, img_id);
            $message(response?.message ?? '更新成功');
            // 重抓 imageData 讓 hasChanges 重置 + tag count 同步
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

    useEffect(() => {
        if (!imageData) return;
        setMainTag(imageData.OmainTag ?? '');
        setSecondaryTag(imageData.OsecondaryTag ?? '');
        setArtistTag(imageData.OArtistTag ?? '');
        setAnotherTag(imageData.OanotherTag ?? '');
        setSource(imageData.source ?? '');
        setIsPublic(imageData.is_public === 'public');
    }, [imageData]);

    const ZOOM_STEP = 25;
    const MIN_ZOOM = 25;
    const MAX_ZOOM = 400;
    const MIRROR_SIZES = [150, 200, 300, 400, 600] as const;

    // TagInput allTags 來源 (memo 不必要因為 imageData 不常變)
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
                                padding: '7px 14px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 12.5,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'color var(--transition-fast)',
                                color: sideMode === 'info' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                            }}
                        >
                            檔案資訊
                        </button>
                        <button
                            type="button"
                            onClick={() => setSideMode('edit')}
                            style={{
                                padding: '7px 14px',
                                background: 'transparent',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 12.5,
                                fontWeight: 500,
                                cursor: 'pointer',
                                transition: 'color var(--transition-fast)',
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
                <div className="detail-stage">
                    {imageData ? (
                        <>
                            <Magnifier
                                src={imgSrc}
                                alt={imageData.img_path}
                                mirrorSize={mirrorSize}
                                imgStyle={{ transform: `scale(${zoom / 100})`, transformOrigin: 'center', transition: 'transform var(--transition-fast)', maxWidth: '100%', maxHeight: '80vh' }}
                                onLoad={(e) => {
                                    const img = e.currentTarget;
                                    setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                                }}
                            />
                            <div className="detail-toolbar">
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                                    disabled={zoom <= MIN_ZOOM}
                                    aria-label="縮小"
                                    title="縮小"
                                >
                                    <Icon.zoomOut size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                                    disabled={zoom >= MAX_ZOOM}
                                    aria-label="放大"
                                    title="放大"
                                >
                                    <Icon.zoomIn size={14} />
                                </button>
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => setZoom(100)}
                                    aria-label="重設"
                                    title="重設 100%"
                                >
                                    <Icon.expand size={14} />
                                </button>
                                <span style={{ width: 1, height: 20, background: 'var(--color-border)', alignSelf: 'center' }} aria-hidden />
                                <button
                                    type="button"
                                    className="icon-btn"
                                    onClick={() => {
                                        const idx = MIRROR_SIZES.indexOf(mirrorSize as typeof MIRROR_SIZES[number]);
                                        const next = MIRROR_SIZES[(idx + 1) % MIRROR_SIZES.length];
                                        setMirrorSize(next);
                                    }}
                                    aria-label={`放大鏡大小 ${mirrorSize}px`}
                                    title={`放大鏡 ${mirrorSize}px (點擊切換)`}
                                >
                                    <Icon.search size={14} />
                                </button>
                            </div>
                            <div className="detail-zoom">
                                {naturalDims && (
                                    <>
                                        <span>{naturalDims.w} × {naturalDims.h}</span>
                                        <span style={{ color: 'var(--color-border)' }}>|</span>
                                    </>
                                )}
                                <span style={{ color: zoom === 100 ? 'var(--color-text-secondary)' : 'var(--color-text-quaternary)' }}>
                                    {zoom === 100 ? 'fit' : '–'}
                                </span>
                                <span style={{ color: 'var(--color-border)' }}>|</span>
                                <span style={{ color: 'var(--color-primary-light)' }}>{zoom}%</span>
                                <span style={{ color: 'var(--color-border)' }}>|</span>
                                <span style={{ color: 'var(--color-text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                    <Icon.search size={11} />{mirrorSize}px
                                </span>
                            </div>
                        </>
                    ) : (
                        <div style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>
                            載入中…
                        </div>
                    )}
                </div>

                <div className="detail-side">
                    {sideMode === 'edit' && <div className="card tag-edit-card">
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
                                onClick={() => setIsPublic((p) => !p)}
                                role="switch"
                                aria-checked={isPublic}
                            />
                        </div>

                        <div className="tag-edit-section">
                            <div className="head">
                                <span className="lbl">人物 mainTag</span>
                                <span className="ct">{mainTag.split(',').filter(Boolean).length}</span>
                            </div>
                            <TagInput
                                allTags={mainAllTags}
                                value={mainTag}
                                name="mainTag"
                                onChange={setMainTag}
                                placeholder="人物標籤,逗號分隔"
                            />
                        </div>

                        <div className="tag-edit-section">
                            <div className="head">
                                <span className="lbl">團體 secondaryTag</span>
                                <span className="ct">{secondaryTag.split(',').filter(Boolean).length}</span>
                            </div>
                            <TagInput
                                allTags={secondaryAllTags}
                                value={secondaryTag}
                                name="secondaryTag"
                                onChange={setSecondaryTag}
                                placeholder="團體標籤,逗號分隔"
                            />
                        </div>

                        <div className="tag-edit-section">
                            <div className="head">
                                <span className="lbl">作者 ArtistTag</span>
                                <span className="ct">{ArtistTag.split(',').filter(Boolean).length}</span>
                            </div>
                            <TagInput
                                allTags={artistAllTags}
                                value={ArtistTag}
                                name="ArtistTag"
                                onChange={setArtistTag}
                                placeholder="作者,逗號分隔"
                            />
                        </div>

                        <div className="tag-edit-section">
                            <div className="head">
                                <span className="lbl">其他 anotherTag</span>
                                <span className="ct">{anotherTag.split(',').filter(Boolean).length}</span>
                            </div>
                            <TagInput
                                allTags={anotherAllTags}
                                value={anotherTag}
                                name="anotherTag"
                                isTextarea
                                onChange={setAnotherTag}
                                placeholder="金髮, 黑絲, 藍瞳, ..."
                            />
                        </div>

                        <div className="tag-edit-section">
                            <div className="head">
                                <span className="lbl">圖源 source</span>
                            </div>
                            <input
                                className="input"
                                value={source}
                                onChange={(e) => setSource(e.target.value)}
                                placeholder="https://..."
                            />
                        </div>
                    </div>}

                    {sideMode === 'info' && imageData && (
                        <div className="card info-card">
                            <h3>檔案資訊<Icon.link size={12} /></h3>
                            <div className="info-row">
                                <span className="k">檔名</span>
                                <span className="v" title={imageData.img_path}>
                                    {imageData.img_path?.split('/').pop() ?? '—'}
                                </span>
                            </div>
                            <div className="info-row">
                                <span className="k">上傳</span>
                                <span className="v">{imageData.created_at?.replace('T', ' ').slice(0, 19) ?? '—'}</span>
                            </div>
                            {imageData.updated_at && (
                                <div className="info-row">
                                    <span className="k">最後修改</span>
                                    <span className="v">{imageData.updated_at.replace('T', ' ').slice(0, 19)}</span>
                                </div>
                            )}
                            <div className="info-row">
                                <span className="k">大小</span>
                                <span className="v">
                                    {imageData.check_img_type === 'HTTP'
                                        ? '— (URL)'
                                        : imageData.file_size
                                            ? `${(Number(imageData.file_size) / 1024).toFixed(1)} KB`
                                            : '—'}
                                </span>
                            </div>
                            {naturalDims && (
                                <div className="info-row">
                                    <span className="k">尺寸</span>
                                    <span className="v">{naturalDims.w} × {naturalDims.h}</span>
                                </div>
                            )}
                            <div className="info-row">
                                <span className="k">類型</span>
                                <span className="v">{imageData.check_img_type ?? '—'}</span>
                            </div>
                            {imageData.source && (
                                <div className="info-row">
                                    <span className="k">圖源</span>
                                    <span className="v">
                                        <a href={imageData.source} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-primary-light)', textDecoration: 'none' }}>
                                            {imageData.source.length > 28 ? imageData.source.slice(0, 28) + '…' : imageData.source} ↗
                                        </a>
                                    </span>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 標籤統計 — 每 tag 顯示 [自有 / 公開] 雙計數 (per koatag tagAmount semantics) */}
                    {sideMode === 'info' && imageData?.tagAmount && (
                        <div className="card info-card">
                            <h3>標籤統計 <span style={{ fontSize: 10, color: 'var(--color-text-quaternary)', fontWeight: 400, letterSpacing: '0.08em' }}>自有 / 公開</span></h3>
                            {[
                                { label: '人物', tags: imageData.mainTag, amounts: imageData.tagAmount.pageMainTagAmount },
                                { label: '團體', tags: imageData.secondaryTag, amounts: imageData.tagAmount.pageSecondaryTagAmount },
                                { label: '作者', tags: imageData.ArtistTag, amounts: imageData.tagAmount.pageArtistTagAmount },
                                { label: '其他', tags: imageData.anotherTag, amounts: imageData.tagAmount.pageAnotherTagAmount },
                            ].map((cat) => {
                                const tagsList = cat.tags ?? [];
                                if (tagsList.length === 0) return null;
                                return (
                                    <div key={cat.label} style={{ marginBottom: 10 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-tertiary)', letterSpacing: '0.08em', marginBottom: 4 }}>
                                            {cat.label}
                                        </div>
                                        {tagsList.map((tagName: string, i: number) => {
                                            const a = cat.amounts?.[i];
                                            const selfCount = a?.[0]?.count ?? 0;
                                            const publicCount = a?.[1]?.count ?? 0;
                                            return (
                                                <div key={`${tagName}-${i}`} className="info-row" style={{ padding: '4px 0' }}>
                                                    <span className="k text" style={{ fontFamily: 'var(--font-family-base)', color: 'var(--color-text-secondary)' }}>{tagName}</span>
                                                    <span className="v">
                                                        {selfCount} / {publicCount}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {sideMode === 'edit' && (
                        <div className="card info-card" style={{ background: 'linear-gradient(135deg, rgba(232,185,106,0.08), transparent)', borderColor: 'rgba(232,185,106,0.2)' }}>
                            <h3 style={{ color: 'var(--color-primary-light)' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                    <Icon.star size={14} />AI 辨識
                                </span>
                            </h3>
                            <p style={{ fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-text-primary)', margin: '0 0 12px' }}>
                                自動辨識圖片中的人物、作品系列、其他標籤，並合併到對應欄位（作者欄需手填）。
                            </p>
                            <Btn
                                variant="primary"
                                size="sm"
                                disabled={isAiLoading || !imageData}
                                onClick={handleAiTag}
                            >
                                {isAiLoading ? '辨識中…' : '開始 AI 辨識'}
                            </Btn>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export { Image_page };
