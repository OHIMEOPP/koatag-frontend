import { useState } from "react";
import { AddNewTag } from "../AddNewTag/AddNewTag";
import { EditTag } from "../EditTag/EditTag";
import { EditTagType } from "../EditTagType/EditTagType";
import { TagData } from "components/types/tags";

import '../../../style/front_page/TagEditor/TagEditor.scss'
import { updateOrCreateTagWithType, updateTagByType } from "services/tag.service";
import { $message, delay } from "utils";

interface Tag {
  tag_name: string;
}

interface TagEditorProps {
  onClose: () => void;
  tagtype: string[] | undefined;
  UncategorizedTags: TagData[] | undefined;
  tagTypeClassification: Record<string, Tag[]>;
}

const TagEditor: React.FC<TagEditorProps> = ({ onClose, tagtype, UncategorizedTags, tagTypeClassification }) => {
  const [editorArea, setEditorArea] = useState<number>(1);

  const [addNewTagFrom, setAddNewTagFrom] = useState({
    tagName: "",
    newType: "",
    currentType: ""
  });
  const [editTag, setEditTagFrom] = useState({
    tagName: "",
    newType: "",
    currentType: ""
  });
  const [editTagType, setEditTagTypeFrom] = useState({
    tagName: [""],
    type: ""
  });

  async function submit_fl_table() {
    // eslint-disable-next-line no-restricted-globals
    if (confirm("要進行操作嗎?")) {
      if (editorArea === 1) {
        if (addNewTagFrom.newType && addNewTagFrom.currentType) {

          alert("請選擇填入新增或現有分類");
          return;
        } else if (addNewTagFrom.newType === "" && addNewTagFrom.currentType === "") {
          alert("請輸入新增或現有分類");
          return;
        } else if (addNewTagFrom.tagName === "") {
          alert("請輸入標籤名稱!");
          return;
        } else {
          console.log(addNewTagFrom);

          const formData = new FormData();

          formData.append('tagName', addNewTagFrom.tagName);
          formData.append('newType', addNewTagFrom.newType);
          formData.append('currentType', addNewTagFrom.currentType);

          const response = await updateOrCreateTagWithType(formData);
          if (response?.data.status === 1) {
            $message(response?.data.message);
            await delay(1);
            window.location.reload();
          }
        }
      }
      if (editorArea === 2) {
        if (editTag.newType && editTag.currentType) {
          alert("請選擇填入新增或現有分類");
          return;
        } else if (editTag.newType === "" && editTag.currentType === "") {
          alert("請輸入新增或現有分類");
          return;
        } else if (editTag.tagName === "") {
          alert("請輸入標籤名稱!");
          return;
        } else {
          console.log(editTag)
          const formData = new FormData();

          formData.append('tagName', editTag.tagName);
          formData.append('newType', editTag.newType);
          formData.append('currentType', editTag.currentType);

          const responese = await updateOrCreateTagWithType(formData);
          if (responese?.data.status === 1) {
            $message(responese?.data.message);
            window.location.reload();
            await delay(1);
          }
        }

      };
      if (editorArea === 3) {
        if (editTagType.tagName.length === 0) {
          alert("請輸入標籤名稱!");
          return;
        } else if (editTagType.type === "") {
          alert("請輸入分類名稱!");
          return;
        } else {
          console.log(editTagType)
          const formData = new FormData();

          formData.append('tagName', JSON.stringify(editTagType.tagName));
          formData.append('type', editTagType.type);

          const responese = await updateTagByType(formData);
          if (responese?.data.status === 1) {
            $message(responese?.data.message);
            window.location.reload();
            await delay(1);
          }
        }

      };
    }
  }

  return (
    <div className="float_window" id="plus_tag_div">
      <div className="pl_tag_w">

        {/* Header */}
        <div className="f_w_head">
          <a href="#" onClick={() => setEditorArea(1)} data-content='add_new_tag'>新增標籤</a>
          <a href="#" onClick={() => setEditorArea(2)} data-content='revise_tag'>修改標籤</a>
          <a href="#" onClick={() => setEditorArea(3)} data-content='tag_type'>標籤分類</a>
          <span onClick={onClose}>✕</span>
        </div>

        {/* Body */}
        <div className="tagArea">
          {editorArea === 1 && (
            <AddNewTag tagtype={tagtype} setAddNewTagFrom={setAddNewTagFrom} />
          )}
          {editorArea === 2 && (
            <EditTag
              tagtype={tagtype}
              tagTypeClassification={tagTypeClassification}
              setEditTagFrom={setEditTagFrom}
            />
          )}
          {editorArea === 3 && (
            <EditTagType
              tagtype={tagtype}
              UncategorizedTags={UncategorizedTags}
              setEditTagTypeFrom={setEditTagTypeFrom}
            />
          )}
        </div>

        {/* Footer */}
        <div className="select_col">
          <a onClick={submit_fl_table} href="#">確定</a>
          <a onClick={onClose} href="#">取消</a>
        </div>
      </div>
    </div>
  );
};

export { TagEditor };
