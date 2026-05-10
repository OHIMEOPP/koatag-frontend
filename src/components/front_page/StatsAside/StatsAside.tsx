import React from 'react';
import { Data, Btn, Icon } from 'components';

interface StatsAsideProps {
    tags: Data | undefined;
}

// Aside 三張統計卡 — 數字全部從 getImageForFront 真實欄位來，AI 建議 card 純視覺
// placeholder 等到 AI 自動標記功能落地（目前後端零 endpoint）。
const StatsAside: React.FC<StatsAsideProps> = ({ tags }) => {
    const totalImg = tags?.images_Amount ?? 0;
    const totalTag = tags?.tags_Amount ?? 0;
    const dup = tags?.duplicateTag?.length ?? 0;
    const uncategorized = tags?.UncategorizedTags?.length ?? 0;

    const mainCnt = tags?.mainTag_Amount ?? 0;
    const secondaryCnt = tags?.secondaryTag_Amount ?? 0;
    const artistCnt = tags?.artist_Amount ?? 0;
    const anotherCnt = tags?.anotherTag_Amount ?? 0;
    const maxCnt = Math.max(mainCnt, secondaryCnt, artistCnt, anotherCnt, 1);

    const pct = (n: number) => `${Math.round((n / maxCnt) * 100)}%`;

    return (
        <>
            <div className="card stats-card">
                <h3>內容統計<span className="more">即時</span></h3>
                <div className="stat-row">
                    <span className="stat-label"><span className="stat-dot" />總圖片數量</span>
                    <span className="stat-val">{totalImg.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label"><span className="stat-dot b" />總標籤數量</span>
                    <span className="stat-val">{totalTag.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label"><span className="stat-dot g" />未分類標籤</span>
                    <span className="stat-val">{uncategorized.toLocaleString()}</span>
                </div>
                <div className="stat-row">
                    <span className="stat-label"><span className="stat-dot r" />重複標籤</span>
                    <span className="stat-val">{dup.toLocaleString()}</span>
                </div>
            </div>

            <div className="card stats-card">
                <h3>標籤分佈<span className="more">本月</span></h3>
                <div className="bar-viz">
                    <div className="bar-row">
                        <div className="top-row"><span>人物標籤</span><span className="num">{mainCnt}</span></div>
                        <div className="bar"><div className="bar-fill" style={{ width: pct(mainCnt) }} /></div>
                    </div>
                    <div className="bar-row">
                        <div className="top-row"><span>團體標籤</span><span className="num">{secondaryCnt}</span></div>
                        <div className="bar"><div className="bar-fill b" style={{ width: pct(secondaryCnt) }} /></div>
                    </div>
                    <div className="bar-row">
                        <div className="top-row"><span>作者標籤</span><span className="num">{artistCnt}</span></div>
                        <div className="bar"><div className="bar-fill g" style={{ width: pct(artistCnt) }} /></div>
                    </div>
                    <div className="bar-row">
                        <div className="top-row"><span>其他標籤</span><span className="num">{anotherCnt}</span></div>
                        <div className="bar"><div className="bar-fill p" style={{ width: pct(anotherCnt) }} /></div>
                    </div>
                </div>
            </div>

            <div className="card stats-card" style={{ background: 'linear-gradient(135deg, rgba(232,185,106,0.08), transparent)', borderColor: 'rgba(232,185,106,0.2)' }}>
                <h3 style={{ color: 'var(--color-primary-light)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <Icon.star size={14} />AI 建議
                    </span>
                </h3>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
                    偵測到 {uncategorized} 個未分類標籤。要使用 AI 自動分類嗎?
                </p>
                <Btn variant="primary" size="sm" onClick={() => alert('AI 自動分類功能尚未開放')}>開始自動分類</Btn>
            </div>
        </>
    );
};

export { StatsAside };
