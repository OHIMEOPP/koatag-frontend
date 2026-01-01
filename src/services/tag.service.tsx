import api from "api/axios";
import { TagResponseType, TagsResponseType } from "components";
import { $message } from "utils";

const user_id = localStorage.getItem('user_id')

export const getAllTag = async () => {
    try {
        const response = await api.get<TagsResponseType>(`/tag/getAllTag/${user_id}`);
        console.log(response);
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error; // 丟出去讓上層決定怎麼處理
    }
}

export const updateTagByType = async (formData: FormData) => {
    try {
        const response = await api.post<TagResponseType>(`/tag/updateTagByType/${user_id}`,
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
        const response = await api.post<TagResponseType>(`/tag/updateOrCreateTagWithType/${user_id}`,
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
        const response = await api.post<TagResponseType>(`/tag/delete/${tag_id}/${user_id}`,
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