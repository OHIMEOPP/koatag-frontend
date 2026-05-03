import React from 'react';
import { Btn, Icon } from 'components';
import type { ImageSort } from 'services/image.service';

interface FilterPanelProps {
    sortValue: ImageSort;
    sortMethod: 'asc' | 'desc';
    activeTag: string | null;
    isPublic: 'public' | 'private' | null;
    untagged: boolean;
    onSortValueChange: (v: ImageSort) => void;
    onSortMethodToggle: () => void;
    onClearTag: () => void;
    onIsPublicChange: (v: 'public' | 'private' | null) => void;
    onUntaggedChange: (v: boolean) => void;
    onReset: () => void;
}

// Sort 只露 3 個 — tag 欄位 (mainTag/...) 是 JSON 字串字典序，語義模糊不展示。
const SORT_OPTIONS: { value: ImageSort; label: string }[] = [
    { value: 'created_at', label: '上傳日期' },
    { value: 'id', label: 'ID' },
    { value: 'img_path', label: '檔名' },
];

const FilterPanel: React.FC<FilterPanelProps> = ({
    sortValue, sortMethod, activeTag, isPublic, untagged,
    onSortValueChange, onSortMethodToggle, onClearTag,
    onIsPublicChange, onUntaggedChange, onReset,
}) => {
    return (
        <aside className="card filter-panel">
            <div>
                <h4>排序方式</h4>
                <div style={{ display: 'flex', gap: 6 }}>
                    <select
                        className="input"
                        value={sortValue}
                        onChange={(e) => onSortValueChange(e.target.value as ImageSort)}
                        style={{ flex: 1, fontSize: 12.5 }}
                    >
                        {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                <h4>公開狀態</h4>
                <div className="radio-list">
                    <label>
                        <input
                            type="checkbox"
                            checked={isPublic === 'public'}
                            onChange={(e) => onIsPublicChange(e.target.checked ? 'public' : null)}
                        />
                        <span>公開</span>
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={isPublic === 'private'}
                            onChange={(e) => onIsPublicChange(e.target.checked ? 'private' : null)}
                        />
                        <span>未公開</span>
                    </label>
                    <label>
                        <input
                            type="checkbox"
                            checked={untagged}
                            onChange={(e) => onUntaggedChange(e.target.checked)}
                        />
                        <span>未分類</span>
                    </label>
                </div>
            </div>

            <Btn variant="ghost" size="sm" icon={<Icon.refresh size={12} />} onClick={onReset}>
                重設篩選
            </Btn>
        </aside>
    );
};

export { FilterPanel };
