import api from "api/axios";
import { ResponseType } from "components";

export const getImageForFront = async () => {
    try {
        const user_id = localStorage.getItem('user_id');
        const response = await api.get<ResponseType>(`/pageInfo/getImageForFront/${user_id}`);
        return response.data;
    } catch (error) {
        console.error("Unexpected Error:", error);
        throw error;
    }
};
