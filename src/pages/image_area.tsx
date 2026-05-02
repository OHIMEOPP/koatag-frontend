import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { getImageForImageReposity } from 'services/image.service';
import { getUploadAreaInfo } from 'services/pageInfo/upload_page.service';
import { Btn, Icon, ImageCard, ImageResponseType, FilterPanel, TagInput, Data } from 'components';

// Step 7.5 — FilterPanel 接動態 (sort works via NodeRED, 其餘 filter UI placeholder)
const Image_area = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const formRef = useRef<HTMLFormElement>(null);
    const [images, setImages] = useState<ImageResponseType>();
    const [sortValue, setSortValue] = useState<string>(localStorage.getItem('sortValue') ?? '上傳日期');
    const [sortMethod, setSortMethod] = useState<'asc' | 'desc'>((localStorage.getItem('sortMethod') as 'asc' | 'desc') ?? 'desc');
    const [editMode, setEditMode] = useState(false);
    const [imageData, setImageData] = useState<Data>();
    const [tagInputHandler, setTagInputHandler] = useState(0);
    const [batchTagValue, setBatchTagValue] = useState('');

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

    useEffect(() => {
        getUploadAreaInfo()
            .then((res) => setImageData(res?.data))
            .catch((e) => console.error('getUploadAreaInfo failed', e));
    }, []);

    const tagTypes = [
        { group: '人物', name: 'mainTag',      tags: imageData?.mainTags?.map((t) => t.tag_name) ?? [] },
        { group: '團體', name: 'secondaryTag', tags: imageData?.secondaryTags?.map((t) => t.tag_name) ?? [] },
        { group: '作者', name: 'ArtistTag',    tags: imageData?.artistTags?.map((t) => t.tag_name) ?? [] },
        { group: '其他', name: 'anotherTag',   tags: imageData?.tagsGroup?.map((t) => t.tag_name) ?? [] },
    ];

    const handleBatchSubmit = () => {
        const checkedIds = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="imagesId"]:checked')).map((c) => +c.id);
        if (checkedIds.length === 0) {
            alert('請先選擇圖片');
            return;
        }
        if (tagInputHandler === 0) {
            alert('請選擇種類');
            return;
        }
        if (!batchTagValue.trim()) {
            alert('請輸入標籤');
            return;
        }
        const selectedType = tagTypes[tagInputHandler - 1];
        alert(
            `批次編輯送出 — 後端 endpoint 尚未實作 (Step 12 補)\n\n` +
            `種類: ${selectedType.group} (${selectedType.name})\n` +
            `標籤: ${batchTagValue}\n` +
            `選中圖片數: ${checkedIds.length}\n` +
            `IDs: ${checkedIds.slice(0, 5).join(', ')}${checkedIds.length > 5 ? '...' : ''}`,
        );
    };

    const cancelBatchEdit = () => {
        setEditMode(false);
        setTagInputHandler(0);
        setBatchTagValue('');
    };

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
                    <Btn
                        variant={editMode ? 'primary' : 'ghost'}
                        size="sm"
                        icon={<Icon.edit size={12} />}
                        onClick={() => editMode ? cancelBatchEdit() : setEditMode(true)}
                    >
                        {editMode ? '取消批次' : '批次編輯'}
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
                        <span className="sort-select" title="目前排序">
                            <Icon.sort size={13} />
                            <span>{sortValue}</span>
                            <span style={{ display: 'inline-flex', transform: sortMethod === 'desc' ? 'rotate(90deg)' : 'rotate(-90deg)' }}>
                                <Icon.chevronRight size={11} />
                            </span>
                        </span>
                        <div className="view-toggle">
                            <button type="button" className="on" title="網格檢視">
                                <Icon.gallery size={13} />
                            </button>
                            <button
                                type="button"
                                title="列表檢視 — 尚未實作"
                                onClick={() => alert('列表檢視尚未實作')}
                            >
                                <Icon.list size={13} />
                            </button>
                        </div>
                    </div>

                    {editMode && (
                        <div className="card" style={{ padding: 16, marginBottom: 16 }}>
                            <div className="v-row v-gap-2" style={{ marginBottom: 12 }}>
                                <strong style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>批次編輯：</strong>
                                {tagTypes.map((tag, idx) => (
                                    <label key={tag.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, cursor: 'pointer' }}>
                                        <input
                                            type="radio"
                                            name="tagGroup"
                                            value={tag.group}
                                            checked={tagInputHandler === idx + 1}
                                            onChange={() => { setTagInputHandler(idx + 1); setBatchTagValue(''); }}
                                        />
                                        <span>{tag.group}</span>
                                    </label>
                                ))}
                            </div>
                            {tagInputHandler > 0 && (
                                <div style={{ marginBottom: 12 }}>
                                    <TagInput
                                        allTags={{ [tagTypes[tagInputHandler - 1].group]: tagTypes[tagInputHandler - 1].tags }}
                                        value={batchTagValue}
                                        name="tagName"
                                        onChange={setBatchTagValue}
                                        placeholder={`輸入 ${tagTypes[tagInputHandler - 1].group} 標籤（多個用逗號分隔）`}
                                    />
                                </div>
                            )}
                            <div className="v-row v-gap-2">
                                <Btn variant="primary" size="sm" onClick={handleBatchSubmit}>送出</Btn>
                                <Btn variant="ghost" size="sm" onClick={cancelBatchEdit}>取消</Btn>
                                <span style={{ fontSize: 11, color: 'var(--color-text-quaternary)', marginLeft: 'auto' }}>
                                    後端 endpoint 待 Step 12 接入
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="image-grid">
                        {images?.data?.length ? (
                            images.data.map((image) => (
                                <ImageCard key={image.id} image={image} editMode={editMode} />
                            ))
                        ) : (
                            <div className="card" style={{ padding: 24, color: 'var(--color-text-tertiary)', fontSize: 13, gridColumn: '1 / -1', textAlign: 'center' }}>
                                {images === undefined ? '載入中…' : '沒有圖片'}
                            </div>
                        )}
                    </div>

                    {totalPageAmount > 1 && (() => {
                        // Compute visible page numbers: 1 / current ±2 / last,
                        // insert ... markers where gaps appear.
                        const visible = Array.from({ length: totalPageAmount }, (_, i) => i + 1)
                            .filter((p) => Math.abs(p - page) < 3 || p === 1 || p === totalPageAmount);
                        const items: Array<number | 'gap-l' | 'gap-r'> = [];
                        visible.forEach((p, i) => {
                            if (i > 0) {
                                const prev = visible[i - 1];
                                if (p - prev > 1) items.push(p > page ? 'gap-r' : 'gap-l');
                            }
                            items.push(p);
                        });
                        const hrefFor = (p: number) => `/main/image_area?page=${p}${strTag}`;
                        return (
                            <div className="pager">
                                {page > 1 && (
                                    <Link to={hrefFor(page - 1)} className="page-btn" aria-label="上一頁">
                                        <Icon.chevronLeft size={13} />
                                    </Link>
                                )}
                                {items.map((it, idx) =>
                                    it === 'gap-l' || it === 'gap-r' ? (
                                        <span key={`${it}-${idx}`} className="page-btn" style={{ color: 'var(--color-text-quaternary)', cursor: 'default' }}>
                                            …
                                        </span>
                                    ) : (
                                        <Link
                                            key={it}
                                            to={hrefFor(it)}
                                            className={`page-btn ${it === page ? 'active' : ''}`}
                                            aria-current={it === page ? 'page' : undefined}
                                        >
                                            {it}
                                        </Link>
                                    ),
                                )}
                                {page < totalPageAmount && (
                                    <Link to={hrefFor(page + 1)} className="page-btn" aria-label="下一頁">
                                        <Icon.chevronRight size={13} />
                                    </Link>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </form>
        </div>
    );
};

export { Image_area };
