import { Data } from "components/types/respones";
import { TagData } from "components/types/tags";
import { useEffect, useRef, useState } from "react";

import "../../../style/front_page/TagBlog/TagBlog.scss"
import { deleteTag } from "services/tag.service";
import { $message, delay } from "utils";

interface TagBlogProps {
    tags: Data | undefined;
    openEdit(): void;
}
const TagBlog = ({ tags, openEdit }: TagBlogProps) => {
    const [TagLine, setTagLine] = useState<TagData[]>();
    const [activeTagGroup, setActiveTagGroup] = useState<string | null>('未分類');
    const [deleteMode, setDeleteMode] = useState(false);

    function minustaggroup() {
        setDeleteMode(!deleteMode);
    }

    useEffect(() => {
        if (tags) {
            // 初始化顯示第一個標籤組的內容，這裡預設為 '未分類'
            setTagLine(tags.UncategorizedTags);
        }
    }, [tags]);

    let user_id = localStorage.getItem('user_id');
    const [requestType, setRequestType] = useState<string>();


    const tagDivRef = useRef<HTMLDivElement>(null);

    var contentDiv = document.getElementById("tablecontent") as HTMLDivElement;

    function tagchange(tags: TagData[]) {
        console.log(tags)
        // contentDiv.textContent = '';
        if (tags.length !== 0) {

            // 設定active
            setActiveTagGroup(tags?.[0].Tag_Group);
            if (tags?.[0].Tag_Group === "anotherTag" && tags?.[0].type === "") setActiveTagGroup("UncategorizedTags");

            setRequestType(tags?.[0].Tag_Group)
            const arr = [tags?.[0].Tag_Group];
            console.log(arr)
            setTagLine([])
            setTagLine(tags)
            console.log(tags);
        } else {
            // contentDiv.textContent = '沒有標籤喔';
             setTagLine([{
                id: 0,
                Tag_Group: '',
                creat_user_id: 1,
                tag_name: '沒有標籤喔',
                type: '',
                created_at: '',
                updated_at: ''
             }])
        }
    }

    async function handleDeleteTag(tagName: string, tagGroup: string, tagId: string | number) {
        // eslint-disable-next-line no-restricted-globals
        if (confirm('要刪除標籤(' + tagName + ')嗎?')) {
            const formData = new FormData();
            formData.append('tagName', tagName);
            formData.append('tagGroup', tagGroup);
            const response = await deleteTag(formData, tagId);
            if (response?.data.status === 1) {
                $message(response?.data.message);
                await delay(1);
                window.location.reload();
            } else {
                $message(response?.data.message);
            }
        }
    }
    function openTagContainer() {
        const tagDiv = tagDivRef.current;
        if (!tagDiv) return;
        tagDiv.classList.toggle('open');
    }

    return (
        <>
            <div className="co1-1" ref={tagDivRef} id="distag">
                <div className="taghead">
                    <h3>我的標籤</h3>
                </div>

                <a href='#' id='p' onClick={() => openEdit()} >+</a>
                <a href='#' id='m' onClick={() => minustaggroup()}>-</a>

                <p id='taggroupline'>
                    <a className={activeTagGroup === "UncategorizedTags" ? "active" : ""} onClick={() => tagchange(tags?.UncategorizedTags ?? [])}>未分類</a>
                    <a className={activeTagGroup === "mainTag" ? "active" : ""} onClick={() => tagchange(tags?.mainTags ?? [])}>人物</a>
                    <a className={activeTagGroup === "secondaryTag" ? "active" : ""} onClick={() => tagchange(tags?.secondaryTags ?? [])}>團體</a>
                    <a className={activeTagGroup === "ArtistTag" ? "active" : ""} onClick={() => tagchange(tags?.artistTags ?? [])}>作者</a>
                    {/* 動態生成的標籤組 */}
                    {tags?.tagsType?.map((type) => (
                        <a
                            key={type}
                            href="#"
                            onClick={async () => {
                                const response = await axios.post<TagData[]>("http://koatag.com:1900/getTagByType", {
                                    fields: type,
                                    colume: 'type',
                                    user_id,
                                });
                                if (response.data) {
                                    setRequestType('anotherTag');
                                    setTagLine(response.data);
                                    setActiveTagGroup(type);
                                }
                            }}
                            className={activeTagGroup === type ? "active" : ""}
                        >
                            {type}
                        </a>
                    ))}
                </p >

                <p><a id='expand' href='#' onClick={() => openTagContainer()}>查看全部</a></p>
                <div id='tablecontent'>
                    {TagLine?.map((tag, index) => (
                        <a
                            key={`${requestType}-${tag.tag_name}-${index}`} // 用 requestType 加強 key
                            href={`/main/image_area?page=1&tag=${tag.tag_name}&group=${tag.Tag_Group}`}
                            draggable
                            data-type={requestType}
                            style={{ "--i": index + 1 } as React.CSSProperties}
                            className="tag-link"
                        >
                            {tag.tag_name}
                            {deleteMode && (
                                <div className="delet_bt" onClick={(e) => { e.preventDefault(); handleDeleteTag(tag.tag_name, tag.Tag_Group, tag.id) }}>
                                    -
                                </div>
                            )}
                        </a>
                    ))}
                </div>

            </div >
        </>
    )
}
export { TagBlog }