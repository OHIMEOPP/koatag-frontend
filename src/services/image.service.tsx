import api from "api/axios";
import { ImageResponseType, ResponseType } from "components";

// D.17 (2026-05-15): user_id 從 URL 拔除，backend 從 JWT 取（spec §15.1 T14 IDOR fix 對齊 Drive endpoints）

export const fetchIcon = async (check_img_type: string, type: string): Promise<ResponseType> => {
    const response = await api.get<ResponseType>(`/image/findOneImg/${check_img_type}/${type}`)
    return response.data
}
export const UploadInterfaceImage = async (formData: FormData) => {
    const response = await api.post<ResponseType>(`/image/InterfaceImage`,
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
    const response = await api.post<ResponseType>(`/image/upload`,
        formData,
        {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }
    );
    return response.data
}
export type ImageSort = 'created_at' | 'id' | 'img_path' | 'character_tag' | 'group_tag' | 'artist_tag';
export type TagGroup = 'character_tag' | 'group_tag' | 'artist_tag' | 'another_tag';

export interface ImageListParams {
    tag?: string;
    tag_group?: TagGroup;
    is_public?: 'public' | 'private';
    untagged?: boolean;
    character_tag_empty?: boolean;
    group_tag_empty?: boolean;
    artist_tag_empty?: boolean;
    another_tag_empty?: boolean;
    date_from?: string;
    date_to?: string;
    sort?: ImageSort;
    order?: 'asc' | 'desc';
    page?: number;
    size?: number;
}

export const getImageList = async (params: ImageListParams = {}): Promise<ImageResponseType> => {
    const response = await api.get<ImageResponseType>(`/image/list`, {
        params,
    });
    return response.data;
};
