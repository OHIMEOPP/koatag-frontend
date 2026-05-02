import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Field, Icon, Data, TagInput } from 'components';
import { getUploadAreaInfo } from 'services/pageInfo/upload_page.service';
import { UploadImage } from 'services/image.service';
import { $message, _dynamictagtype } from 'utils';

// Step 8.3 + 8.4 — dropzone drag/drop + file picker + preview + URL mode
// (file 跟 URL 並存可選, submit 時 8.6 決定送哪邊)
const Upload_area: React.FC = () => {
    const navigate = useNavigate();
    const [uploadAreaInfo, setUploadAreaInfo] = useState<Data>();
    const [files, setFiles] = useState<File[]>([]);
    const [httpUrl, setHttpUrl] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewUrlsRef = useRef<string[]>([]);

    useEffect(() => {
        getUploadAreaInfo()
            .then((res) => res?.data && setUploadAreaInfo(res.data))
            .catch((e) => console.error('getUploadAreaInfo failed', e));
    }, []);

    // Cleanup blob URLs on unmount
    useEffect(() => {
        return () => {
            previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        };
    }, []);

    const maxFiles = uploadAreaInfo?.max_file_uploads;
    const maxSizeMB = uploadAreaInfo?.upload_max_filesize_MB;
    const totalSizeMB = uploadAreaInfo?.post_max_size_MB;

    // Carousel state — selectedIdx 是 big preview 顯示的那張，stripPage 是縮圖 strip 分頁
    const STRIP_PER_PAGE = 8;
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [stripPage, setStripPage] = useState(1);
    const totalStripPages = Math.max(1, Math.ceil(files.length / STRIP_PER_PAGE));

    useEffect(() => {
        // Clamp selected when files shrink
        if (selectedIdx >= files.length && files.length > 0) setSelectedIdx(files.length - 1);
        if (files.length === 0) setSelectedIdx(0);
        if (stripPage > totalStripPages) setStripPage(totalStripPages);
    }, [selectedIdx, files.length, stripPage, totalStripPages]);

    const visibleStripStart = (stripPage - 1) * STRIP_PER_PAGE;
    const visibleStripFiles = files.slice(visibleStripStart, visibleStripStart + STRIP_PER_PAGE);

    // Tag input + isPublic + source state
    const [mainTag, setMainTag] = useState('');
    const [secondaryTag, setSecondaryTag] = useState('');
    const [ArtistTag, setArtistTag] = useState('');
    const [anotherTag, setAnotherTag] = useState('');
    const [source, setSource] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const resetForm = () => {
        clearAll();
        setHttpUrl('');
        setMainTag('');
        setSecondaryTag('');
        setArtistTag('');
        setAnotherTag('');
        setSource('');
        setIsPublic(true);
    };

    const handleSubmit = async () => {
        // 至少要一個來源
        if (files.length === 0 && !httpUrl.trim()) {
            $message('請先選擇檔案或輸入圖片網址', 'warning');
            return;
        }

        const formData = new FormData();

        // 檔案 OR URL（兩個都送也可以；後端 Controller 自己挑，file 優先）
        if (files.length > 0) {
            files.forEach((f) => formData.append('uploadimg[]', f));
            formData.append('check_img_type', 'normal');
        } else if (httpUrl.trim()) {
            formData.append('uploadimgHTTP', httpUrl.trim());
            // check_img_type 後端 hardcode 'HTTP' 不用送
        }

        // Tag 欄位 (字串逗號分隔, 後端 TagTrait 會 split + JSON encode)
        if (mainTag.trim())      formData.append('mainTag', mainTag.trim());
        if (secondaryTag.trim()) formData.append('secondaryTag', secondaryTag.trim());
        if (ArtistTag.trim())    formData.append('ArtistTag', ArtistTag.trim());
        if (anotherTag.trim())   formData.append('anotherTag', anotherTag.trim());

        if (source.trim()) formData.append('source', source.trim());

        // isPublic: truthy 才送, falsy 完全省略 (PHP `?` 才會走 'private' 分支)
        if (isPublic) formData.append('isPublic', '1');

        setSubmitting(true);
        $message('上傳中，請稍後...');
        try {
            const response = await UploadImage(formData);
            // status 對照 (per koatag 2026-05-02 確認):
            //   1 = 成功
            //   2 = 重複圖片 (同 user 同 path 已存在) — 不是成功!
            //   0 = 未上傳
            //  -1 = 伺服器錯誤
            if (response.status === 1) {
                $message(response.message ?? '上傳成功');
                resetForm();
            } else if (response.status === 2) {
                $message(response.message ?? '這張圖片已上傳過', 'warning');
                // 不清表單, 讓使用者改 tag 或選別張再試
            } else if (response.status === 0) {
                $message(response.message ?? '未收到上傳檔案', 'warning');
            } else {
                $message(response.message ?? '上傳失敗', 'error');
            }
        } catch (err) {
            $message(`上傳失敗\n${err}`, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const removeCurrent = () => {
        if (files.length === 0) return;
        const url = previewUrlsRef.current[selectedIdx];
        if (url) URL.revokeObjectURL(url);
        previewUrlsRef.current.splice(selectedIdx, 1);
        setFiles((prev) => {
            const next = prev.filter((_, i) => i !== selectedIdx);
            // adjust selectedIdx if removed last
            if (selectedIdx >= next.length && next.length > 0) setSelectedIdx(next.length - 1);
            return next;
        });
    };

    const validateAndAdd = (incoming: FileList | File[]) => {
        const list = Array.from(incoming);
        if (!maxFiles || !maxSizeMB || !totalSizeMB) {
            $message('上傳限制尚未載入完成', 'warning');
            return;
        }
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        const totalSizeBytes = totalSizeMB * 1024 * 1024;

        // Per-file size check
        const tooLarge = list.find((f) => f.size >= maxSizeBytes);
        if (tooLarge) {
            $message(`${tooLarge.name} (${(tooLarge.size / 1024 / 1024).toFixed(2)} MB) 大於單檔上限 ${maxSizeMB} MB`, 'warning');
            return;
        }

        // Combined count check
        if (files.length + list.length > maxFiles) {
            $message(`最多只能上傳 ${maxFiles} 個檔案 (目前 ${files.length} + 新增 ${list.length})`, 'warning');
            return;
        }

        // Combined total size check
        const newTotal = [...files, ...list].reduce((s, f) => s + f.size, 0);
        if (newTotal >= totalSizeBytes) {
            $message(`總大小 ${(newTotal / 1024 / 1024).toFixed(2)} MB 超過 ${totalSizeMB} MB`, 'warning');
            return;
        }

        // All clear — generate preview URLs and append
        const urls = list.map((f) => URL.createObjectURL(f));
        previewUrlsRef.current.push(...urls);
        setFiles((prev) => [...prev, ...list]);
    };

    const handleDrag = (e: React.DragEvent, active: boolean) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(active);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files?.length) {
            validateAndAdd(e.dataTransfer.files);
        }
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            validateAndAdd(e.target.files);
            e.target.value = ''; // reset so same file can be picked again
        }
    };
    const removeFile = (idx: number) => {
        const url = previewUrlsRef.current[idx];
        if (url) URL.revokeObjectURL(url);
        previewUrlsRef.current.splice(idx, 1);
        setFiles((prev) => prev.filter((_, i) => i !== idx));
    };
    const clearAll = () => {
        previewUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
        previewUrlsRef.current = [];
        setFiles([]);
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="t-h1 page-title">上傳圖片</h1>
                    <p className="page-sub">
                        {maxSizeMB && totalSizeMB
                            ? `支援 PNG / JPG / WEBP · 單檔最大 ${maxSizeMB} MB · 批次最多 ${totalSizeMB} MB · 最多 ${maxFiles} 張`
                            : '載入限制中…'}
                    </p>
                </div>
                <div className="v-row v-gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => { resetForm(); navigate('/main/image_area'); }} disabled={submitting}>
                        取消
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={handleSubmit} disabled={submitting}>
                        {submitting ? '上傳中…' : '送出'}
                    </Btn>
                </div>
            </div>

            <div className="upload-grid">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={handleFileChange}
                />

                {files.length === 0 ? (
                    // Empty state — full CTA (icon, btn, URL input, meta)
                    <div
                        className={`dropzone ${dragActive ? 'is-active' : ''}`}
                        onDragEnter={(e) => handleDrag(e, true)}
                        onDragOver={(e) => handleDrag(e, true)}
                        onDragLeave={(e) => handleDrag(e, false)}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <div className="dz-icon"><Icon.upload size={28} /></div>
                        <div>
                            <div className="dz-title">拖曳圖片到此處，或點擊選擇</div>
                            <div className="dz-sub">支援多檔 · 也可以貼上網址直接抓取（下方）</div>
                        </div>
                        <Btn variant="primary" icon={<Icon.upload size={12} />} onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
                            選擇檔案
                        </Btn>

                        <div className="dz-or" style={{ width: '100%', maxWidth: 380 }}>OR</div>

                        <div className="dz-input" onClick={(e) => e.stopPropagation()}>
                            <input
                                className="input"
                                placeholder="https://x.com/...  圖片 URL"
                                value={httpUrl}
                                onChange={(e) => setHttpUrl(e.target.value)}
                            />
                            <Btn
                                variant="secondary"
                                icon={<Icon.link />}
                                onClick={(e) => { e.stopPropagation(); setHttpUrl(httpUrl.trim()); }}
                                disabled={!httpUrl.trim()}
                            >
                                就緒
                            </Btn>
                        </div>

                        <div className="dz-meta">
                            <span>已選 <b>0</b> 檔</span>
                            {httpUrl.trim() && <span>URL <b>已輸入</b></span>}
                            {maxFiles && <span>上限 <b>{maxFiles}</b></span>}
                        </div>
                    </div>
                ) : (
                    // Carousel state — big preview + thumb strip + pager
                    <div
                        className={`dropzone ${dragActive ? 'is-active' : ''}`}
                        style={{ padding: 16, gap: 12, justifyContent: 'flex-start' }}
                        onDragEnter={(e) => handleDrag(e, true)}
                        onDragOver={(e) => handleDrag(e, true)}
                        onDragLeave={(e) => handleDrag(e, false)}
                        onDrop={handleDrop}
                    >
                        {/* Big preview */}
                        <div style={{
                            position: 'relative',
                            flex: 1,
                            width: '100%',
                            borderRadius: 'var(--radius-md)',
                            backgroundImage: `url(${previewUrlsRef.current[selectedIdx]})`,
                            backgroundSize: 'contain',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'no-repeat',
                            background: `var(--color-bg-primary) url(${previewUrlsRef.current[selectedIdx]}) center/contain no-repeat`,
                            border: '1px solid var(--color-border)',
                            minHeight: 0,
                        }}>
                            {/* Remove current btn */}
                            <button
                                type="button"
                                onClick={removeCurrent}
                                style={{
                                    position: 'absolute', top: 10, right: 10,
                                    width: 30, height: 30,
                                    padding: 0,
                                    borderRadius: '50%',
                                    background: 'rgba(239, 79, 94, 0.92)',
                                    backdropFilter: 'blur(8px)',
                                    WebkitBackdropFilter: 'blur(8px)',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'grid', placeItems: 'center',
                                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                                    lineHeight: 0,
                                }}
                                aria-label="移除這張"
                                title="移除這張"
                            >
                                <Icon.x size={14} />
                            </button>
                            {/* Image counter (bottom-left) */}
                            <div style={{
                                position: 'absolute', bottom: 10, left: 10,
                                padding: '4px 10px',
                                background: 'rgba(11,13,18,0.7)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                fontFamily: 'var(--font-family-mono)',
                                color: 'var(--color-text-primary)',
                            }}>
                                {selectedIdx + 1} / {files.length}
                            </div>
                            {/* Filename (bottom-right) */}
                            <div style={{
                                position: 'absolute', bottom: 10, right: 10, maxWidth: '60%',
                                padding: '4px 10px',
                                background: 'rgba(11,13,18,0.7)',
                                backdropFilter: 'blur(8px)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: 11,
                                fontFamily: 'var(--font-family-mono)',
                                color: 'var(--color-text-primary)',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}>
                                {files[selectedIdx]?.name}
                            </div>
                        </div>

                        {/* Thumb strip */}
                        <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {visibleStripFiles.map((f, vi) => {
                                const i = visibleStripStart + vi;
                                return (
                                    <div
                                        key={`${f.name}-${i}`}
                                        onClick={() => setSelectedIdx(i)}
                                        style={{
                                            width: 56, height: 56,
                                            borderRadius: 6,
                                            border: i === selectedIdx ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                            backgroundImage: `url(${previewUrlsRef.current[i]})`,
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            cursor: 'pointer',
                                            boxShadow: i === selectedIdx ? '0 0 0 2px var(--color-primary-glow)' : undefined,
                                            transition: 'all var(--transition-fast)',
                                            flexShrink: 0,
                                        }}
                                        title={f.name}
                                    />
                                );
                            })}
                        </div>

                        {/* Strip pager + actions */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'space-between' }}>
                            {totalStripPages > 1 ? (
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <button
                                        type="button"
                                        className="page-btn"
                                        style={{ minWidth: 28, height: 28 }}
                                        onClick={() => setStripPage((p) => Math.max(1, p - 1))}
                                        disabled={stripPage === 1}
                                    >
                                        <Icon.chevronLeft size={11} />
                                    </button>
                                    <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', alignSelf: 'center', padding: '0 4px' }}>
                                        {stripPage} / {totalStripPages}
                                    </span>
                                    <button
                                        type="button"
                                        className="page-btn"
                                        style={{ minWidth: 28, height: 28 }}
                                        onClick={() => setStripPage((p) => Math.min(totalStripPages, p + 1))}
                                        disabled={stripPage === totalStripPages}
                                    >
                                        <Icon.chevronRight size={11} />
                                    </button>
                                </div>
                            ) : <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>共 {files.length} 張</span>}
                            <div className="v-row v-gap-2">
                                <Btn variant="ghost" size="sm" icon={<Icon.plus />} onClick={() => fileInputRef.current?.click()}>
                                    加入
                                </Btn>
                                <Btn variant="ghost" size="sm" icon={<Icon.trash />} onClick={clearAll}>
                                    清空
                                </Btn>
                            </div>
                        </div>
                    </div>
                )}

                <div className="card upload-form">
                    <h3>圖片資訊</h3>

                    <Field label="人物 (main tag)" hint="多個用半形逗號分隔">
                        <TagInput
                            allTags={{ '人物': uploadAreaInfo?.mainTags?.map((t) => t.tag_name) ?? [] }}
                            value={mainTag}
                            name="mainTag"
                            onChange={setMainTag}
                            placeholder="輸入人物標籤"
                        />
                    </Field>

                    <Field label="團體 (second tag)" hint="多個用半形逗號分隔">
                        <TagInput
                            allTags={{ '團體': uploadAreaInfo?.secondaryTags?.map((t) => t.tag_name) ?? [] }}
                            value={secondaryTag}
                            name="secondaryTag"
                            onChange={setSecondaryTag}
                            placeholder="輸入團體標籤"
                        />
                    </Field>

                    <Field label="作者 (artist tag)" hint="多個用半形逗號分隔">
                        <TagInput
                            allTags={{ '作者': uploadAreaInfo?.artistTags?.map((t) => t.tag_name) ?? [] }}
                            value={ArtistTag}
                            name="ArtistTag"
                            onChange={setArtistTag}
                            placeholder="輸入作者"
                        />
                    </Field>

                    <Field label="其他標籤 (another tag)" hint="自定 type 自動分組顯示">
                        <TagInput
                            allTags={(() => {
                                const grouped = _dynamictagtype(uploadAreaInfo?.tagsGroup ?? []) as Record<string, Array<{ tag_name: string }>> | undefined;
                                if (!grouped) return { '其他': [] };
                                return Object.fromEntries(
                                    Object.entries(grouped).map(([k, arr]) => [k || '未分類', arr.map((t) => t.tag_name)])
                                );
                            })()}
                            value={anotherTag}
                            name="anotherTag"
                            isTextarea
                            onChange={setAnotherTag}
                            placeholder="金髮, 黑絲, 藍瞳, ..."
                        />
                    </Field>

                    <Field label="圖源 (source URL)" hint="可貼來源網址">
                        <input
                            className="input"
                            placeholder="https://..."
                            value={source}
                            onChange={(e) => setSource(e.target.value)}
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
                            onClick={() => setIsPublic((p) => !p)}
                            role="switch"
                            aria-checked={isPublic}
                        />
                    </div>
                </div>
            </div>

        </div>
    );
};

export { Upload_area };
