import React from 'react';
import { Btn, Icon } from 'components';

interface FilterPanelProps {
    sortValue: string;
    sortMethod: 'asc' | 'desc';
    activeTag: string | null;
    onSortValueChange: (v: string) => void;
    onSortMethodToggle: () => void;
    onClearTag: () => void;
    onReset: () => void;
}

// v3 .filter-panel 給 GalleryPage 用。
// 排序 select / 排序方向 btn / Active tag chip 是 work 的 (透過 NodeRED selectSort+order+tag)。
// 標籤分類 / 公開狀態 / Date 是 placeholder (per 路線 C, NodeRED 不接這些 query),
// 等 Step 12 list endpoint 搬回 Laravel 才能 wire-up 真實 filter。
const SORT_OPTIONS = [
    '上傳日期', 'ID', '圖片名稱', '人物', '團體', '作者', 'public',
    '人物未修改', '團體未修改', '作者未修改', '其他標籤未修改',
];

const FilterPanel: React.FC<FilterPanelProps> = ({
    sortValue, sortMethod, activeTag, onSortValueChange, onSortMethodToggle, onClearTag, onReset,
}) => {
    return (
        <aside className="card filter-panel">
            <div>
                <h4>排序方式</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                    <select
                        className="input"
                        value={sortValue}
                        onChange={(e) => onSortValueChange(e.target.value)}
                        style={{ flex: 1, fontSize: 12.5 }}
                    >
                        {SORT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <button
                        type="button"
                        className="icon-btn"
                        onClick={onSortMethodToggle}
                        title={`切換排序 (現為 ${sortMethod === 'desc' ? '降序' : '升序'})`}
                        style={{ width: 36, height: 36, flexShrink: 0 }}
                    >
                        <span style={{ display: 'inline-flex', transform: sortMethod === 'desc' ? 'rotate(90deg)' : 'rotate(-90deg)', transition: 'transform 0.2s' }}>
                            <Icon.chevronRight />
                        </span>
                    </button>
                </div>
            </div>

            {activeTag && (
                <div>
                    <h4>目前篩選</h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        <span className="chip" style={{ cursor: 'pointer' }} onClick={onClearTag} title="點擊清除">
                            {activeTag} <span style={{ marginLeft: 4, color: 'var(--color-text-tertiary)' }}>×</span>
                        </span>
                    </div>
                </div>
            )}

            <div>
                <h4>標籤分類</h4>
                <div className="radio-list">
                    {['人物', '團體', '作者', '其他'].map((c) => (
                        <label key={c}>
                            <input type="radio" name="cat" disabled />
                            <span>{c}</span>
                            <span className="count">—</span>
                        </label>
                    ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-quaternary)', margin: '4px 0 0' }}>
                    需 Step 12 後端支援
                </p>
            </div>

            <div>
                <h4>公開狀態</h4>
                <div className="radio-list">
                    <label><input type="checkbox" disabled /><span>公開</span><span className="count">—</span></label>
                    <label><input type="checkbox" disabled /><span>未公開</span><span className="count">—</span></label>
                    <label><input type="checkbox" disabled /><span>未分類</span><span className="count">—</span></label>
                </div>
                <p style={{ fontSize: 11, color: 'var(--color-text-quaternary)', margin: '4px 0 0' }}>
                    需 Step 12 後端支援
                </p>
            </div>

            <Btn variant="ghost" size="sm" icon={<Icon.refresh size={12} />} onClick={onReset}>
                重設篩選
            </Btn>
        </aside>
    );
};

export { FilterPanel };
