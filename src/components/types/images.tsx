import { TagAmount } from "./tags";

export interface ImageData {
    id?: number;
    img_path: string;
    // NodeRED getImage 回傳 tag 陣列為 string[]（純 tag 名）；空時是 null 而不是 []
    // (verified 2026-05-02 via debug log on actual response)。
    mainTag: string[] | null;
    secondaryTag: string[] | null;
    ArtistTag: string[] | null;
    anotherTag: string[] | null;
    creat_user_id: string | number;
    check_img_type: string | undefined;
    // 'public' / 'private' 字串
    is_public: string;
    source: string;
    created_at: string;
    updated_at?: string;
    file_size: number;
    OmainTag: string;
    OsecondaryTag: string;
    OArtistTag: string;
    OanotherTag: string;
    tagAmount: TagAmount;
}



