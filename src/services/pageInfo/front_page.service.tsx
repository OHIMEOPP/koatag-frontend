import api from "api/axios";
import { ResponseType } from "components";

// D.17 (2026-05-15): user_id 從 URL 拔除，backend 從 JWT 取
export const getImageForFront = async () => {
    try {
        const response = await api.get<ResponseType>(`/pageInfo/getImageForFront`);
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error;
    }
};
