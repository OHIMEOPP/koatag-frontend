import api from "api/axios";
import { ResponseType } from "components"

export const getImagePageInfo = async (img_id: string) => {
    try {
        const user_id = localStorage.getItem('user_id');
        const response = await api.get<ResponseType>(`/pageInfo/getImageForPage/${img_id}/${user_id}`);
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error; // 丟出去讓上層決定怎麼處理
    }
}
export const update = async (formData: FormData, img_id: string) => {
    try {
        const user_id = localStorage.getItem('user_id');
        const response = await api.post<ResponseType>(`/image/updateImageData/${img_id}/${user_id}`,
            formData,
            {
                headers: {
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error; // 丟出去讓上層決定怎麼處理
    }
}