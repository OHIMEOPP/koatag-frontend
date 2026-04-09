import api from "api/axios";
import { ImageResponseType, ResponseType } from "components";

export const fetchIcon = async (check_img_type: string, type: string, user_id: string): Promise<ResponseType> => {
    const response = await api.get<ResponseType>(`/image/findOneImg/${check_img_type}/${type}/${user_id}`)
    // console.log(response.data)
    return response.data
}
export const UploadInterfaceImage = async (formData: FormData) => {
    const user_id = localStorage.getItem('user_id');
    const response = await api.post<ResponseType>(`/image/InterfaceImage/${user_id}`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }
    );
    return response
}
export const UploadImage = async (formData: FormData) => {
    const user_id = localStorage.getItem('user_id');
    const response = await api.post<ResponseType>(`/image/upload/${user_id}`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }
    );
    return response.data
}
export const getImageForImageReposity = async (formData: FormData) => {
    // formData.forEach((value, key) => {
    //     console.log(key, value);
    // });
    const response = await api.post<ImageResponseType>(
        `/getImage`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }
    );
    return response.data
}

export const UploadImages = async (formData: FormData) => {
    const user_id = localStorage.getItem('user_id');
    const response = await api.post<ResponseType>(
        `/image/uploadBatchImages/${user_id}`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }
    );
    return response.data
}