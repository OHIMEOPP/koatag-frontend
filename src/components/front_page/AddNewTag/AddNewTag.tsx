import { TagData } from "components/types/tags";

import '../../../style/front_page/AddNewTag/AddNewTag.scss';
import { useState } from "react";

interface AddNewTagProps {
    tagtype: string[] | undefined;
    setAddNewTagFrom: React.Dispatch<
        React.SetStateAction<{
            tagName: string;
            newType: string;
            currentType: string;
        }>
    >;
}

const AddNewTag: React.FC<AddNewTagProps> = ({ tagtype, setAddNewTagFrom }) => {
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const onHandleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setAddNewTagFrom((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    return (
        <>
            {/* <!-- 新增標籤區域 是預設顯示 --> */}
            <div className="add_new_tag" style={{ display: "block" }}>
                <form id="add_new_tag_form" method="post" action="frontpagetagedit.php">
                    <div id="f_w__input">
                        <h4>
                            <p>標籤名稱</p>
                        </h4>
                        <input
                            id="f_w_p_T_I"
                            type="text"
                            name="tagName"
                            onChange={onHandleChange}
                            placeholder="輸入您的標籤名稱"
                        />
                        <h4>
                            <p>新增分類</p>
                        </h4>
                        <input
                            id="f_w_p_TG_I"
                            type="text"
                            name="newType"
                            onChange={onHandleChange}
                            placeholder="要新增分類嗎?"
                        />
                    </div>

                    <h4>
                        <p>選擇現有分類</p>
                    </h4>

                    <div className="checktag">
                        {["人物", "團體", "作者", ...(tagtype ?? [])].map((type) => (
                            <button
                                key={type}
                                type="button"
                                className={`tag-btn ${selectedType === type ? "active" : ""}`}
                                onClick={() => {
                                    setAddNewTagFrom((prev) => ({
                                        ...prev,
                                        currentType: type,
                                    }))
                                    setSelectedType(type);
                                }
                                }
                            >
                                <input
                                    type="radio"
                                    id={type}
                                    name="currentType"
                                    value={type}
                                    checked={false} // ✅ 可以依 state.currentType 控制 checked
                                    onChange={onHandleChange}
                                    hidden
                                />
                                {type}
                            </button>
                        ))}
                    </div>
                </form>
            </div>
        </>
    );
};

export { AddNewTag };
