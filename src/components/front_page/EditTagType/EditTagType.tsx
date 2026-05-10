import { TagData } from "components/types/tags"
import { useState } from "react";

import '../../../style/front_page/EditTagType/EditTagType.scss'

interface EditTagTypeProps {
    tagtype: string[] | undefined;
    UncategorizedTags: TagData[] | undefined;
    setEditTagTypeFrom: React.Dispatch<React.SetStateAction<{
        tagName: string[];
        type: string;
    }>>
}
const EditTagType: React.FC<EditTagTypeProps> = ({ tagtype, UncategorizedTags, setEditTagTypeFrom }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedTags, setSelectedTags] = useState<string[]>([]);

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
        );
        setEditTagTypeFrom(prev => {
            const newTagName = prev.tagName.includes(tag)
                ? prev.tagName.filter(r => r !== tag)
                : [...prev.tagName, tag];

            return {
                ...prev,
                tagName: newTagName.filter(r => r !== ""),
            };
        });
    }

    return (
        <div className="EditTagType">
            <h4>選擇分類</h4>
            <div className="tag_type_checktag">
                {tagtype?.map(type => (
                    <button
                        key={type}
                        type="button"
                        className={`tag-btn ${selectedType === type ? "active" : ""}`}
                        onClick={() => {
                            setSelectedType(type);
                            setEditTagTypeFrom(prev => ({ ...prev, type: type }));
                        }}
                    >
                        {type}
                    </button>
                ))}
            </div>

            <h4>未分類標籤</h4>
            <div className="tag_type_checktag_chose_tag">
                {UncategorizedTags?.map(tag => (
                    <button
                        key={tag.tag_name}
                        type="button"
                        className={`tag-btn ${selectedTags.includes(tag.tag_name) ? "active" : ""}`}
                        onClick={() => toggleTag(tag.tag_name)}
                    >
                        {tag.tag_name}
                    </button>
                ))}
            </div>
        </div>
    );
}
export { EditTagType }
