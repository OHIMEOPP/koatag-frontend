import React from 'react';
import { Data, Icon } from 'components';

interface SideInfoCardsProps {
    imageData: Data;
    naturalDims: { w: number; h: number } | null;
}

// 「檔案資訊」+「標籤統計」兩張 read-only card, info mode 顯示
const SideInfoCards: React.FC<SideInfoCardsProps> = ({ imageData, naturalDims }) => (
    <>
        <div className="card info-card">
            <h3>檔案資訊<Icon.link size={12} /></h3>
            <div className="info-row">
                <span className="k">檔名</span>
                <span className="v" title={imageData.img_path}>{imageData.img_path?.split('/').pop() ?? '—'}</span>
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

        {imageData.tagAmount && (
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
                                        <span className="v">{selfCount} / {publicCount}</span>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        )}
    </>
);

export { SideInfoCards };
