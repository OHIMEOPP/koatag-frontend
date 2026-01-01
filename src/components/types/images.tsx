import { TagAmount } from "./tags";

export interface ImageData {
    id?: number;
    img_path: string;
    mainTag: [];
    secondaryTag: [];
    ArtistTag: [];
    anotherTag: [];
    creat_user_id: string;
    check_img_type: string | undefined;
    is_public: string;
    source: string;
    created_at: string;
    file_size: number
    OmainTag: string;
    OsecondaryTag: string;
    OArtistTag: string;
    OanotherTag: string;
    tagAmount: TagAmount;
}



