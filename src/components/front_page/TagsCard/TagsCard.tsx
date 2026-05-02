import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Data, TagData, Btn, Icon } from 'components';
import { deleteTag } from 'services/tag.service';
import { $message, delay } from 'utils';

interface TagsCardProps {
    tags: Data | undefined;
    onOpenEditor: () => void;
}

interface TabSpec {
    id: string;
    label: string;
    items: TagData[];
}

// v3 .tags-card replacing legacy TagBlog. Same external behaviour:
// - 4 fixed tabs (人物/團體/作者/未分類) + N dynamic from tagsType
// - chip click → /main/image_area?page=1&tag=X&group=Y
// - 批次刪除 mode → click chip calls deleteTag service
// - 新增/編輯 btn → onOpenEditor (parent opens TagEditor in step 6.7)
//
// Departure from legacy: dynamic-type tab content is filtered client-side from the
// already-loaded tagsGroup, instead of POSTing per-click to the dead NodeRED
// `getTagByType` endpoint.
const TagsCard: React.FC<TagsCardProps> = ({ tags, onOpenEditor }) => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('all');
    const [deleteMode, setDeleteMode] = useState(false);

    const fixedTabs: TabSpec[] = tags ? [
        {
            id: 'all', label: '全部', items: [
                ...(tags.mainTags ?? []),
                ...(tags.secondaryTags ?? []),
                ...(tags.artistTags ?? []),
                ...(tags.tagsGroup ?? []),
                ...(tags.UncategorizedTags ?? []),
            ],
        },
        { id: 'mainTag',       label: '人物',   items: tags.mainTags ?? [] },
        { id: 'secondaryTag',  label: '團體',   items: tags.secondaryTags ?? [] },
        { id: 'ArtistTag',     label: '作者',   items: tags.artistTags ?? [] },
        { id: 'uncategorized', label: '未分類', items: tags.UncategorizedTags ?? [] },
    ] : [];

    const dynamicTabs: TabSpec[] = (tags?.tagsType ?? []).map((type) => ({
        id: `type:${type}`,
        label: type,
        items: (tags?.tagsGroup ?? []).filter((t) => t.type === type),
    }));

    const allTabs = [...fixedTabs, ...dynamicTabs];
    const activeItems = allTabs.find((t) => t.id === activeTab)?.items ?? [];

    const handleChipClick = (tag: TagData) => {
        navigate(
            `/main/image_area?page=1&tag=${encodeURIComponent(tag.tag_name)}&group=${encodeURIComponent(tag.Tag_Group)}`
        );
    };

    const handleDelete = async (tag: TagData) => {
        // eslint-disable-next-line no-restricted-globals
        if (!confirm(`要刪除標籤「${tag.tag_name}」嗎?`)) return;
        const formData = new FormData();
        formData.append('tagName', tag.tag_name);
        formData.append('tagGroup', tag.Tag_Group);
        const response = await deleteTag(formData, tag.id);
        if (response?.data.status === 1) {
            $message(response.data.message);
            await delay(1);
            window.location.reload();
        } else {
            $message(response?.data.message ?? '刪除失敗');
        }
    };

    return (
        <div className="card tags-card">
            <div className="tags-head">
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>我的標籤</h3>
                <span style={{ color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-family-mono)', fontSize: 11 }}>
                    {tags?.tags_Amount ?? 0} tags · {tags?.images_Amount ?? 0} imgs
                </span>
            </div>
            <div style={{ height: 14 }} />
            <div className="tag-tabs" style={{ flexWrap: 'wrap' }}>
                {allTabs.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        className={`tag-tab ${activeTab === t.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(t.id)}
                    >
                        {t.label}<span className="num">{t.items.length}</span>
                    </button>
                ))}
            </div>
            <div className="tag-toolbar">
                <Btn size="sm" icon={<Icon.plus />} onClick={onOpenEditor}>新增 / 編輯標籤</Btn>
                <Btn size="sm" variant={deleteMode ? 'danger' : 'ghost'} onClick={() => setDeleteMode((d) => !d)}>
                    {deleteMode ? '完成' : '批次刪除'}
                </Btn>
            </div>
            <div className="tags-flow">
                {activeItems.length === 0 ? (
                    <span style={{ color: 'var(--color-text-quaternary)', fontSize: 13 }}>沒有標籤</span>
                ) : (
                    activeItems.map((tag, i) => (
                        <span
                            key={`${tag.id}-${i}`}
                            className="chip"
                            style={{ cursor: 'pointer' }}
                            onClick={() => (deleteMode ? handleDelete(tag) : handleChipClick(tag))}
                            title={deleteMode ? '點擊刪除' : '點擊跳到圖庫'}
                        >
                            {tag.tag_name}
                            {deleteMode && <span style={{ marginLeft: 4, color: 'var(--color-danger)', fontWeight: 700 }}>×</span>}
                        </span>
                    ))
                )}
            </div>
        </div>
    );
};

export { TagsCard };
