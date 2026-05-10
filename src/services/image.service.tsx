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
export type ImageSort = 'created_at' | 'id' | 'img_path' | 'mainTag' | 'secondaryTag' | 'ArtistTag';
export type TagGroup = 'mainTag' | 'secondaryTag' | 'ArtistTag' | 'anotherTag';

export interface ImageListParams {
    tag?: string;
    tag_group?: TagGroup;
    is_public?: 'public' | 'private';
    untagged?: boolean;
    mainTag_empty?: boolean;
    secondaryTag_empty?: boolean;
    ArtistTag_empty?: boolean;
    anotherTag_empty?: boolean;
    date_from?: string;
    date_to?: string;
    sort?: ImageSort;
    order?: 'asc' | 'desc';
    page?: number;
    size?: number;
}

export const getImageList = async (user_id: string, params: ImageListParams = {}): Promise<ImageResponseType> => {
    // direct 打 Laravel；axios interceptor 預設把 GET 導 NodeRED，這裡顯式覆寫。
    const response = await api.get<ImageResponseType>(`/image/list/${user_id}`, {
        baseURL: process.env.REACT_APP_API_URL,
        params,
    });
    return response.data;
};

