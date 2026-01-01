export interface TagData {
    id: number;
    tag_name: string;
    type: string;
    Tag_Group: string;
    creat_user_id: number;
    created_at: string;
    updated_at: string;
}

export interface TagAmount {
    pageMainTagAmount: TagAmountDetailed[][];
    pageSecondaryTagAmount: TagAmountDetailed[][];
    pageArtistTagAmount: TagAmountDetailed[][];
    pageAnotherTagAmount: TagAmountDetailed[][];
}
export interface TagAmountDetailed {
    tag_name: string;
    count: number;
}

export interface duplicateTag{
    creat_user_id: number;
    tag_name: string;
    type: string;
    Tag_Group: string;
    duplicate_count: number;
}