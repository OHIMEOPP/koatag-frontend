import { Data } from "components/types/respones";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { update } from "services/pageInfo/image_page.service";
import { $message, _dynamictagtype, delay, getFilePath } from "utils"

import '../../style/image_page/imageEditor/imageEditor.scss';
import { TagInput } from "components/TagInput";

interface Tag {
    tag_name: string;
}

interface ImageEditorProps {
    imageData: Data | undefined;
    onClose(): void;
    isPublic: boolean;
    setIsPublic: React.Dispatch<React.SetStateAction<boolean>>;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ imageData, onClose, isPublic, setIsPublic }) => {
    const user_id = localStorage.getItem('user_id') ?? '0';

    const urlParams = new URLSearchParams(window.location.search);
    const img_id = urlParams.get('img_id');

    const formRef = useRef<HTMLFormElement>(null);
    const demoRef = useRef<HTMLDivElement>(null);
    const [tagsGroup, setTagsGroup] = useState<Record<string, Tag[]>>();
    const whole_imgRef = useRef<HTMLImageElement>(null);
    const float_oContainer = useRef<HTMLDivElement>(null);
    const [anotherValue, setAnotherValue] = useState<string>('');
    const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());

    // Memoize 其他 TagInput 的回調，防止不必要的重新渲染
    const handleMainTagChange = useCallback((val: string) => {
        const input = formRef.current?.elements.namedItem('mainTag') as HTMLInputElement | null;
        if (input) input.value = val;
    }, []);

    const handleSecondaryTagChange = useCallback((val: string) => {
        if (formRef.current) {
            const input = formRef.current.elements.namedItem('secondaryTag') as HTMLInputElement;
            if (input) input.value = val;
        }
    }, []);

    const handleArtistTagChange = useCallback((val: string) => {
        if (formRef.current) {
            const input = formRef.current.elements.namedItem('ArtistTag') as HTMLInputElement;
            if (input) input.value = val;
        }
    }, []);

    const handleAnotherTagChange = useCallback((val: string) => {
        const input = formRef.current?.elements.namedItem('anotherTag') as HTMLInputElement | null;
        if (input) {
            input.value = val;
        }
        setAnotherValue(val); // 更新父組件的狀態
    }, []);

    // Memoize allTags 物件，防止每次渲染時都重新創建
    const mainTagsData = useMemo(() => ({
        "人物": imageData?.mainTags?.map(t => t.tag_name) || []
    }), [imageData?.mainTags]);

    const secondaryTagsData = useMemo(() => ({
        "團體": imageData?.secondaryTags?.map(t => t.tag_name) || []
    }), [imageData?.secondaryTags]);

    const artistTagsData = useMemo(() => ({
        "作者": imageData?.artistTags?.map(t => t.tag_name) || []
    }), [imageData?.artistTags]);

    useEffect(() => {
        // 從 anotherValue 中提取標籤 (假設用逗號或其他分隔符)
        if (anotherValue) {
            const tags = anotherValue
                .split(/[,，\s]+/) // 支持逗號或空格作為分隔符
                .map(tag => tag.trim())
                .filter(tag => tag.length > 0);
            setSelectedTags(new Set(tags));
        } else {
            setSelectedTags(new Set());
        }
    }, [anotherValue]);

    const groupedTags: Record<string, string[]> = imageData?.tagsGroup?.reduce((acc, tag) => {
        if (!acc[tag.type]) acc[tag.type] = [];
        acc[tag.type].push(tag.tag_name); // 只存字串
        return acc;
    }, {} as Record<string, string[]>) || {};

    // Helper function: 更新 anotherTag 的值
    const updateAnotherTagValue = useCallback((newValue: string) => {
        const input = formRef.current?.elements.namedItem('anotherTag') as HTMLInputElement | null;
        if (input) {
            input.value = newValue;
        }
        setAnotherValue(newValue);
    }, []);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        const form = formRef.current;


        if (!img_id || !form) return
        e.preventDefault();

        $message("上傳中，請稍後...")
        const formData = new FormData(form)
        const response = await update(formData, img_id);
        if (response.status === 1) {
            $message(response.message)
            await delay(1);
            window.location.reload();
            // form.reset();
        } else if (response.status === 2) {
            $message(response.message)
            // form.reset();
        } else {
            $message("網站出現錯誤", "error")
        }
    }

    function closeare(event: React.MouseEvent<HTMLButtonElement>) {
        event.preventDefault();
        const tagsGroup = imageData?.tagsGroup;
        
        if (!tagsGroup) return;

        // 設置 tagsGroup 以顯示 demo 區域
        setTagsGroup(_dynamictagtype(tagsGroup));
        
        // 如果有現存的 anotherTag 值，用它初始化 selectedTags
        // 否則如果有 OanotherTag，用它初始化
        if (!anotherValue && imageData?.OanotherTag) {
            setAnotherValue(imageData.OanotherTag);
        }
    }

    // 放大鏡區------------------------------------------------
    useEffect(() => {
        const floatContainer = float_oContainer.current;
        const floatMirror = document.querySelector('#float_mirror') as HTMLElement;
        const floatBigImg = document.querySelector('#float_zoomImg') as HTMLImageElement;
        
        if (!floatContainer || !floatMirror || !floatBigImg) return;

        let floatLastMouseX = 0;
        let floatLastMouseY = 0;
        let floatScale = 3;
        let floatMirrorStatus = true;

        const floatMirrorFollow = (e: MouseEvent) => {
            if (!floatContainer || !whole_imgRef.current) return;

            const bounds = whole_imgRef.current.getBoundingClientRect();
            const mouseX = e.clientX + window.scrollX;
            const mouseY = e.clientY + window.scrollY;

            const inside =
                mouseX >= bounds.left + window.scrollX &&
                mouseX <= bounds.right + window.scrollX &&
                mouseY >= bounds.top + window.scrollY &&
                mouseY <= bounds.bottom + window.scrollY;

            if (!inside) {
                floatMirror.style.display = "none";
                return;
            }

            floatMirror.style.display = "block";
            const dis_left = e.clientX - floatContainer.offsetLeft;
            const dis_top = e.clientY - floatContainer.offsetTop;

            floatLastMouseX = dis_left;
            floatLastMouseY = dis_top;

            floatMirror.style.left = dis_left - floatMirror.offsetWidth / 2 + window.scrollX + 'px';
            floatMirror.style.top = dis_top - floatMirror.offsetHeight / 2 + window.scrollY + 'px';

            floatMirrorUpdate(dis_left, dis_top, floatScale);
        };

        const floatMirrorUpdate = (dis_left: number, dis_top: number, scale: number) => {
            floatBigImg.style.transform = `scale(${scale})`;
            floatBigImg.style.left = `${-((floatBigImg.offsetWidth) * scale / floatContainer.offsetWidth * dis_left - floatMirror.offsetWidth / 2)}px`;
            floatBigImg.style.top = `${-((floatBigImg.offsetHeight) * scale / floatContainer.offsetHeight * dis_top - floatMirror.offsetHeight / 2)}px`;
        };

        const floatHandleMouseLeave = () => {
            floatMirror.style.display = 'none';
        };

        const floatWheelHandler = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.5 : 0.5;
            floatScale += delta;
            floatScale = Math.max(1, Math.min(10, floatScale));
            floatMirrorUpdate(floatLastMouseX, floatLastMouseY, floatScale);
        };

        const floatMirrorClickHandler = () => {
            floatMirrorStatus = !floatMirrorStatus;
            if (floatMirrorStatus) {
                floatContainer.addEventListener('mouseleave', floatHandleMouseLeave);
                floatContainer.addEventListener('mousemove', floatMirrorFollow);
            } else {
                floatContainer.removeEventListener('mouseleave', floatHandleMouseLeave);
                floatContainer.removeEventListener('mousemove', floatMirrorFollow);
            }
        };

        // 事件監聽器設置
        floatContainer.addEventListener('wheel', floatWheelHandler, { passive: false });
        floatContainer.addEventListener('mouseleave', floatHandleMouseLeave);
        floatContainer.addEventListener('mousemove', floatMirrorFollow);
        floatMirror.addEventListener('click', floatMirrorClickHandler);

        // Cleanup: 移除事件監聽器防止內存洩漏
        return () => {
            floatContainer.removeEventListener('wheel', floatWheelHandler);
            floatContainer.removeEventListener('mouseleave', floatHandleMouseLeave);
            floatContainer.removeEventListener('mousemove', floatMirrorFollow);
            floatMirror.removeEventListener('click', floatMirrorClickHandler);
        };
    }, []);
    return (
        <>
            <div className="float_window imageEditor" id="">
                <div className='float_set_window'>
                    <div id="float_container" ref={float_oContainer}>
                        <img
                            id="setpreview"
                            ref={whole_imgRef}
                            src={
                                imageData?.check_img_type === "HTTP"
                                    ? imageData?.img_path
                                    : `${getFilePath(user_id, imageData?.img_path ?? '')}`
                            }
                            className="col-xs-12 col-sm-4 thumbnail"
                            alt="..."
                        />
                        <div id="float_mirror">
                            <img
                                id="float_zoomImg"
                                src={
                                    imageData?.check_img_type === "HTTP"
                                        ? imageData?.img_path
                                        : `${getFilePath(user_id, imageData?.img_path ?? '')}`
                                }
                                alt=""
                            />
                        </div>
                    </div>

                    <form ref={formRef} onSubmit={handleSubmit} method="post" id="set_tag_m">
                        <div style={{ display: "flex" }}>
                            <p>圖片狀態(status)</p>
                            <label className="switch">
                                <input
                                    type="checkbox"
                                    onChange={() => setIsPublic(!isPublic)}
                                    id="toggleSwitch"
                                    name="isPublic"
                                    checked={isPublic}
                                />
                                <span className="slider round"></span>
                            </label>
                            <p id="status">狀態: {isPublic ? "公開" : "私人"}</p>
                        </div>

                        <div>
                            人物
                            <TagInput
                                allTags={mainTagsData}
                                value={imageData?.OmainTag || ''}
                                name={"mainTag"}
                                onChange={handleMainTagChange}
                                placeholder="請輸入人物,人物..."
                            />
                        </div>
                        <div>
                            團體
                            <TagInput
                                allTags={secondaryTagsData}
                                value={imageData?.OsecondaryTag || ''}
                                name={"secondaryTag"}
                                onChange={handleSecondaryTagChange}
                                placeholder="請輸入團體,團體..."
                            />
                        </div>
                        <div>
                            作者
                            <TagInput
                                allTags={artistTagsData}
                                value={imageData?.OArtistTag || ''}
                                name={"ArtistTag"}
                                onChange={handleArtistTagChange}
                                placeholder="請輸入作者,作者..."
                            />
                        </div>
                        <div>
                            圖源
                            <div>
                                <input type="text" name="source" id="set_source" defaultValue={imageData?.source} />
                            </div>
                        </div>
                        <div>
                            其他
                            <div>
                                <TagInput
                                    allTags={groupedTags}
                                    value={imageData?.OanotherTag || ''}
                                    name="anotherTag"
                                    isTextarea={true}
                                    inputListaner={(val) => {
                                        // 這裡可以用 val 去做 sreach_drop 或其他操作
                                        // console.log("最新文字", val);
                                        // 可以改造成呼叫原本的 inputListaner
                                        // setAnotherValue(val);
                                        // setInputValue([]);
                                    }}
                                    onChange={handleAnotherTagChange}
                                    
                                    placeholder="請輸入Q版,金髮..."
                                />

                            </div>
                        </div>

                        <div className="relate_tags">

                            <button
                                onClick={(e) => closeare(e)}
                                id="c_another"
                                data-toggle="collapse"
                                data-target="#demo"
                            >
                                其他
                            </button>
                        </div>

                        <button type="submit">確定</button>
                        <button onClick={() => onClose()}>取消</button>
                    </form>
                    <div id="demo" ref={demoRef} className="collapse">
                        {
                            tagsGroup &&
                            Object.entries(tagsGroup).map(([key, types]) => (
                                <div key={key}>
                                    <p>{key}</p>

                                    {types.map((type) => (
                                        <a
                                            key={type.tag_name}
                                            draggable
                                            className={selectedTags.has(type.tag_name) ? 'active' : ''}
                                            onClick={(e) => {
                                                e.preventDefault();
                                                const tagName = type.tag_name;
                                                
                                                // 如果已經在 selectedTags 中，就移除；否則就添加
                                                const newTags = new Set(selectedTags);
                                                if (selectedTags.has(tagName)) {
                                                    newTags.delete(tagName);
                                                } else {
                                                    newTags.add(tagName);
                                                }
                                                const newValue = Array.from(newTags).join(',');
                                                updateAnotherTagValue(newValue);
                                            }}
                                        >
                                            {type.tag_name}
                                        </a>
                                    ))}
                                </div>
                            ))}
                    </div>

                </div>

            </div>
        </>
    )
}

export { ImageEditor }