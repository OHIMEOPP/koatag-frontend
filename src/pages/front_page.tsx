import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Data, ProfileHero, TagsCard, StatsAside, RecentActivity, PublicTagsCard, TagEditor } from 'components';
import { getImageForFront } from 'services/pageInfo/front_page.service';
import { _dynamictagtype } from 'utils';

import "cropperjs/dist/cropper.css";

// Step 6.7 — TagEditor modal wired to TagsCard 「新增 / 編輯標籤」btn.
// 編輯資料 btn 仍 alert 待實作（profile 編輯獨立功能，redesign 沒設計）。
const Front_page = () => {
    const navigate = useNavigate();
    const [tags, setTags] = useState<Data>();
    const [showTagEditor, setShowTagEditor] = useState(false);

    useEffect(() => {
        getImageForFront()
            .then((res) => setTags(res?.result))
            .catch((e) => console.error('getImageForFront failed', e));
    }, []);

    const handleEditProfile = () => alert('編輯個人資料功能尚未開放');
    const handleOpenEditor = () => {
        setShowTagEditor(true);
        document.body.classList.add('no-scroll');
    };
    const handleCloseEditor = () => {
        setShowTagEditor(false);
        document.body.classList.remove('no-scroll');
    };
    const handleUpload = () => navigate('/main/upload_area');

    return (
        <div className="page">
            {showTagEditor && (
                <TagEditor
                    onClose={handleCloseEditor}
                    tagtype={tags?.tagsType}
                    UncategorizedTags={tags?.UncategorizedTags}
                    tagTypeClassification={_dynamictagtype(tags?.tagsGroup) ?? {}}
                />
            )}
            <ProfileHero onEditProfile={handleEditProfile} onUpload={handleUpload} />

            <div className="front-grid">
                <div className="front-main">
                    <TagsCard tags={tags} onOpenEditor={handleOpenEditor} />
                    <RecentActivity />
                    <PublicTagsCard />
                </div>
                <aside style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 64 }}>
                    <StatsAside tags={tags} />
                </aside>
            </div>
        </div>
    );
};

export { Front_page };
