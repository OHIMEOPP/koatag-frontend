import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getImageForImageReposity } from 'services/image.service';
import { Btn, Icon, ImageCard, ImageResponseType, FilterPanel } from 'components';

// Step 7.5 — FilterPanel 接動態 (sort works via NodeRED, 其餘 filter UI placeholder)
const Image_area = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const formRef = useRef<HTMLFormElement>(null);
    const [images, setImages] = useState<ImageResponseType>();
    const [sortValue, setSortValue] = useState<string>(localStorage.getItem('sortValue') ?? '上傳日期');
    const [sortMethod, setSortMethod] = useState<'asc' | 'desc'>((localStorage.getItem('sortMethod') as 'asc' | 'desc') ?? 'desc');

    const urlParams = new URLSearchParams(location.search);
    const page = parseInt(urlParams.get('page') ?? '1', 10);
    const tagParam = urlParams.get('tag');
    const groupParam = urlParams.get('group');
    const strTag = tagParam ? `&tag=${tagParam}${groupParam ? `&group=${groupParam}` : ''}` : '';
    const totalPageAmount = Math.ceil(Number(images?.count ?? 0) / 30);

    useEffect(() => {
        const fetchImages = async () => {
            try {
                const form = formRef.current;
                if (!form) return;

                const tags = urlParams.getAll('tag');
                let tag: any = null;
                if (tags.length > 0) {
                    tag = groupParam ? { [groupParam]: tags } : tags;
                }

                const formData = new FormData(form);
                formData.set('order', sortMethod);
                formData.set('selectSort', sortValue);
                formData.append('amount', '30');
                formData.append('page', `${page - 1}`);
                formData.append('userId', `${localStorage.getItem('user_id')}`);
                formData.append('tag', JSON.stringify(tag));

                const res = await getImageForImageReposity(formData);
                setImages(res);
            } catch (e) {
                console.error('getImageForImageReposity failed', e);
            }
        };
        fetchImages();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search, sortValue, sortMethod]);

    const handleSortValueChange = (v: string) => {
        setSortValue(v);
        localStorage.setItem('sortValue', v);
    };
    const handleSortMethodToggle = () => {
        setSortMethod((prev) => {
            const next = prev === 'desc' ? 'asc' : 'desc';
            localStorage.setItem('sortMethod', next);
            return next;
        });
    };
    const handleClearTag = () => {
        navigate('/main/image_area?page=1');
    };
    const handleReset = () => {
        setSortValue('上傳日期');
        setSortMethod('desc');
        localStorage.setItem('sortValue', '上傳日期');
        localStorage.setItem('sortMethod', 'desc');
        navigate('/main/image_area?page=1');
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="t-h1 page-title">圖庫</h1>
                    <p className="page-sub">共 {images?.count ?? 0} 張圖片</p>
                </div>
                <div className="v-row v-gap-2">
                    <Btn variant="ghost" size="sm" icon={<Icon.edit size={12} />} onClick={() => alert('批次編輯 — 等 Step 7.7 接入')}>
                        批次編輯
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={() => navigate('/main/upload_area')}>
                        上傳
                    </Btn>
                </div>
            </div>

            <form ref={formRef} className="gallery-shell">
                <FilterPanel
                    sortValue={sortValue}
                    sortMethod={sortMethod}
                    activeTag={tagParam}
                    onSortValueChange={handleSortValueChange}
                    onSortMethodToggle={handleSortMethodToggle}
                    onClearTag={handleClearTag}
                    onReset={handleReset}
                />

                <div>
                    <div className="gallery-toolbar">
                        <span className="toolbar-meta">
                            顯示 <b>{images?.data?.length ? `${(page - 1) * 30 + 1}–${(page - 1) * 30 + images.data.length}` : '0'}</b>
                            {' '}共 <b>{images?.count ?? 0}</b> 張
                        </span>
                        <div className="spacer" />
                        <span style={{ color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                            [7.6] view-toggle
                        </span>
                    </div>

                    <div className="image-grid">
                        {images?.data?.length ? (
                            images.data.map((image) => (
                                <ImageCard key={image.id} image={image} editMode={false} />
                            ))
                        ) : (
                            <div className="card" style={{ padding: 24, color: 'var(--color-text-tertiary)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center' }}>
                                {images === undefined ? '載入中…' : '沒有圖片'}
                            </div>
                        )}
                    </div>

                    {totalPageAmount > 1 && (
                        <div className="pager">
                            {page > 1 && (
                                <a href={`/main/image_area?page=${page - 1}${strTag}`} className="page-btn">‹</a>
                            )}
                            {Array.from({ length: totalPageAmount }, (_, i) => i + 1)
                                .filter((p) => Math.abs(p - page) < 5 || p === 1 || p === totalPageAmount)
                                .map((p) => (
                                    <a
                                        key={p}
                                        href={p === page ? '#' : `/main/image_area?page=${p}${strTag}`}
                                        className={`page-btn ${p === page ? 'active' : ''}`}
                                    >
                                        {p}
                                    </a>
                                ))}
                            {page < totalPageAmount && (
                                <a href={`/main/image_area?page=${page + 1}${strTag}`} className="page-btn">›</a>
                            )}
                        </div>
                    )}
                </div>
            </form>
        </div>
    );
};

export { Image_area };
