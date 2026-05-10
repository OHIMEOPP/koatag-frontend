import React, { useEffect, useRef, useState } from 'react';
import { Btn, Icon } from 'components';
import { $message } from 'utils';

interface DropzoneProps {
    files: File[];
    onFilesChange: (files: File[]) => void;
    httpUrl: string;
    onHttpUrlChange: (v: string) => void;
    maxFiles: number | undefined;
    maxSizeMB: number | undefined;
    totalSizeMB: number | undefined;
}

// Upload page 的左側 dropzone — 兩種狀態:
// - files = []: empty CTA (drag/drop / 選檔 btn / URL 輸入)
// - files > 0: carousel (大圖 + 縮圖 strip + 分頁 + 加入/清空)
// 拖放、檔案校驗、preview blob URL 管理都在這, 對外只暴露 controlled props (files / httpUrl)
const Dropzone: React.FC<DropzoneProps> = ({
    files, onFilesChange, httpUrl, onHttpUrlChange, maxFiles, maxSizeMB, totalSizeMB,
}) => {
    const [dragActive, setDragActive] = useState(false);
    const [selectedIdx, setSelectedIdx] = useState(0);
    const [stripPage, setStripPage] = useState(1);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewUrlsRef = useRef<string[]>([]);

    // Sync previewUrls with files (lazy create + revoke on shrink)
    useEffect(() => {
        // Create URLs for new files (those without an existing entry at same index)
        const cur = previewUrlsRef.current;
        // Truncate to files length, revoking removed urls
        if (cur.length > files.length) {
            cur.slice(files.length).forEach((u) => URL.revokeObjectURL(u));
            cur.length = files.length;
        }
        // Generate URLs for newly-added entries
        for (let i = cur.length; i < files.length; i++) {
            cur[i] = URL.createObjectURL(files[i]);
        }
    }, [files]);

    // Cleanup all blob URLs on unmount
    useEffect(() => {
        const ref = previewUrlsRef.current;
        return () => {
            ref.forEach((u) => URL.revokeObjectURL(u));
        };
    }, []);

    const STRIP_PER_PAGE = 8;
    const totalStripPages = Math.max(1, Math.ceil(files.length / STRIP_PER_PAGE));
    useEffect(() => {
        if (selectedIdx >= files.length && files.length > 0) setSelectedIdx(files.length - 1);
        if (files.length === 0) setSelectedIdx(0);
        if (stripPage > totalStripPages) setStripPage(totalStripPages);
    }, [selectedIdx, files.length, stripPage, totalStripPages]);

    const visibleStripStart = (stripPage - 1) * STRIP_PER_PAGE;
    const visibleStripFiles = files.slice(visibleStripStart, visibleStripStart + STRIP_PER_PAGE);

    const validateAndAdd = (incoming: FileList | File[]) => {
        const list = Array.from(incoming);
        if (!maxFiles || !maxSizeMB || !totalSizeMB) {
            $message('上傳限制尚未載入完成', 'warning');
            return;
        }
        const maxSizeBytes = maxSizeMB * 1024 * 1024;
        const totalSizeBytes = totalSizeMB * 1024 * 1024;

        const tooLarge = list.find((f) => f.size >= maxSizeBytes);
        if (tooLarge) {
            $message(`${tooLarge.name} (${(tooLarge.size / 1024 / 1024).toFixed(2)} MB) 大於單檔上限 ${maxSizeMB} MB`, 'warning');
            return;
        }
        if (files.length + list.length > maxFiles) {
            $message(`最多只能上傳 ${maxFiles} 個檔案 (目前 ${files.length} + 新增 ${list.length})`, 'warning');
            return;
        }
        const newTotal = [...files, ...list].reduce((s, f) => s + f.size, 0);
        if (newTotal >= totalSizeBytes) {
            $message(`總大小 ${(newTotal / 1024 / 1024).toFixed(2)} MB 超過 ${totalSizeMB} MB`, 'warning');
            return;
        }

        onFilesChange([...files, ...list]);
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
        if (e.dataTransfer.files?.length) validateAndAdd(e.dataTransfer.files);
    };
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            validateAndAdd(e.target.files);
            e.target.value = '';
        }
    };
    const removeCurrent = () => {
        if (files.length === 0) return;
        const newFiles = files.filter((_, i) => i !== selectedIdx);
        onFilesChange(newFiles);
    };
    const clearAll = () => onFilesChange([]);

    return (
        <>
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileChange}
            />

            {files.length === 0 ? (
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
                            onChange={(e) => onHttpUrlChange(e.target.value)}
                        />
                        <Btn variant="secondary" icon={<Icon.link />} onClick={(e) => { e.stopPropagation(); onHttpUrlChange(httpUrl.trim()); }} disabled={!httpUrl.trim()}>
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
                        position: 'relative', flex: 1, width: '100%',
                        borderRadius: 'var(--radius-md)',
                        background: `var(--color-bg-primary) url(${previewUrlsRef.current[selectedIdx]}) center/contain no-repeat`,
                        border: '1px solid var(--color-border)',
                        minHeight: 0,
                    }}>
                        <button
                            type="button"
                            onClick={removeCurrent}
                            style={{
                                position: 'absolute', top: 10, right: 10,
                                width: 30, height: 30, padding: 0, borderRadius: '50%',
                                background: 'rgba(239, 79, 94, 0.92)', backdropFilter: 'blur(8px)',
                                color: '#fff', border: 'none', cursor: 'pointer',
                                display: 'grid', placeItems: 'center', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
                                lineHeight: 0,
                            }}
                            aria-label="移除這張"
                            title="移除這張"
                        >
                            <Icon.x size={14} />
                        </button>
                        <div style={{
                            position: 'absolute', bottom: 10, left: 10,
                            padding: '4px 10px',
                            background: 'rgba(11,13,18,0.7)', backdropFilter: 'blur(8px)',
                            borderRadius: 'var(--radius-sm)', fontSize: 11,
                            fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)',
                        }}>
                            {selectedIdx + 1} / {files.length}
                        </div>
                        <div style={{
                            position: 'absolute', bottom: 10, right: 10, maxWidth: '60%',
                            padding: '4px 10px',
                            background: 'rgba(11,13,18,0.7)', backdropFilter: 'blur(8px)',
                            borderRadius: 'var(--radius-sm)', fontSize: 11,
                            fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-primary)',
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
                                        width: 56, height: 56, borderRadius: 6,
                                        border: i === selectedIdx ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                                        backgroundImage: `url(${previewUrlsRef.current[i]})`,
                                        backgroundSize: 'cover', backgroundPosition: 'center',
                                        cursor: 'pointer',
                                        boxShadow: i === selectedIdx ? '0 0 0 2px var(--color-primary-glow)' : undefined,
                                        transition: 'all var(--transition-fast)', flexShrink: 0,
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
                                    type="button" className="page-btn" style={{ minWidth: 28, height: 28 }}
                                    onClick={() => setStripPage((p) => Math.max(1, p - 1))} disabled={stripPage === 1}
                                ><Icon.chevronLeft size={11} /></button>
                                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)', alignSelf: 'center', padding: '0 4px' }}>
                                    {stripPage} / {totalStripPages}
                                </span>
                                <button
                                    type="button" className="page-btn" style={{ minWidth: 28, height: 28 }}
                                    onClick={() => setStripPage((p) => Math.min(totalStripPages, p + 1))} disabled={stripPage === totalStripPages}
                                ><Icon.chevronRight size={11} /></button>
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
        </>
    );
};

export { Dropzone };
