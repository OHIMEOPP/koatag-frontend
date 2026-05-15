import api from "api/axios";
import { TagResponseType, TagsResponseType } from "components";
import { $message } from "utils";

// D.17 (2026-05-15): user_id 從 URL 拔除，backend 從 JWT 取

export const getAllTag = async () => {
    try {
        const response = await api.get<TagsResponseType>(`/tag/getAllTag`);
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error; // 丟出去讓上層決定怎麼處理
    }
}

export const updateTagByType = async (formData: FormData) => {
    try {
        const response = await api.post<TagResponseType>(`/tag/updateTagByType`,
            formData,
            {
                headers: {
                }
            }
        );
        return response;
    } catch (error) {
        console.error("Unexpected Error:", error);
        $message(`伺服器錯誤... > 500`, 'error');
    }
}

export const updateOrCreateTagWithType = async (formData: FormData) => {
    try {
        const response = await api.post<TagResponseType>(`/tag/updateOrCreateTagWithType`,
            formData,
            {
                headers: {
                }
            }
        );
        return response;
    } catch (error) {
        console.error("Unexpected Error:", error);
        $message(`伺服器錯誤... > 500`, 'error');
    }
}

export const deleteTag = async (formData: FormData, tag_id: string | number) => {
    try {
        const response = await api.post<TagResponseType>(`/tag/delete/${tag_id}`,
            formData,
            {
                headers: {
                }
            }
        );
        return response;
    } catch (error) {
        console.error("Unexpected Error:", error);
        $message(`伺服器錯誤... > 500`, 'error');
    }
}
