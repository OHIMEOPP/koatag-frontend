import { TagData } from "components/types/tags";
import { useState } from "react";

import "../../../style/front_page/EditTag/EditTag.scss";

interface Tag {
  tag_name: string;
}

interface EditTagProps {
  tagtype: string[] | undefined;
  tagTypeClassification: Record<string, Tag[]>;
  setEditTagFrom: React.Dispatch<
    React.SetStateAction<{
      tagName: string;
      newType: string;
      currentType: string;
    }>
  >;
}

const EditTag: React.FC<EditTagProps> = ({
  tagtype,
  tagTypeClassification,
  setEditTagFrom,
}) => {
  const [editTagArea, setEditorArea] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState<string>("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "tagName") setTagInput(value);

    setEditTagFrom((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSelectTag = (tagName: string) => {
    setTagInput(tagName);
    setEditTagFrom((prev) => ({
      ...prev,
      tagName: tagName,
    }));
    setEditorArea(2);
  };

  const handleSelectType = (type: string) => {
    setSelectedType(type);
    setEditTagFrom((prev) => ({
      ...prev,
      currentType: type,
    }));
  };

  return (
    <div className="revise_tag">
      {editTagArea === 1 && (
        <div id="revise_tag_checktag_after" style={{ display: "block" }}>
          <h4>
            <p>選擇修改標籤</p>
          </h4>
          <div className="revise_tag_checktag">
            {Object.entries(tagTypeClassification).map(([key, types]) => (
              <div key={`group-${key}`}>
                <p>{key}</p>
                {types.map((type, index) => (
                  <button
                    key={`revise-${key}-${index}-${type.tag_name}`}
                    onClick={() => handleSelectTag(type.tag_name)}
                  >
                    {type.tag_name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {editTagArea === 2 && (
        <form id="revise_tag_form" method="post">
          <h4>
            <a href="#" onClick={() => setEditorArea(1)}>
              ← 返回
            </a>
          </h4>
          <div id="f_w__input">
            <h4>
              <p>標籤名稱</p>
            </h4>
            <input
              id="f_w_fixed_T_I"
              value={tagInput}
              onChange={handleInputChange}
              type="text"
              placeholder="輸入您的標籤名稱"
              name="tagName"
            />

            <h4>
              <p>新增分類</p>
            </h4>
            <input
              id="f_w_fixed_TG_I"
              onChange={handleInputChange}
              type="text"
              placeholder="要新增分類嗎?"
              name="newType"
            />
          </div>

          <h4>
            <p>選擇現有分類</p>
          </h4>
          <div className="revise_tag_type_checktag">
            {tagtype?.map((type) => (
              <button
                key={type}
                type="button"
                className={selectedType === type ? "active" : ""}
                onClick={() => handleSelectType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </form>
      )}
    </div>
  );
};

export { EditTag };
