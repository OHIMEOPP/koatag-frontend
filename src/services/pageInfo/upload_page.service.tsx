import api from "api/axios";
import { ResponseType } from "components"

export const getUploadAreaInfo = async () => {
    try {
        const user_id = localStorage.getItem('user_id');
        const response = await api.get<ResponseType>(`/pageInfo/getUploadAreaInfo/${user_id}`);
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error; // 丟出去讓上層決定怎麼處理
    }
}