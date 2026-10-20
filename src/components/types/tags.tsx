export interface TagData {
    id: number;
    tag_name: string;
    type: string;
    tag_group: string;
    user_id: number;
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
    user_id: number;
    tag_name: string;
    type: string;
    tag_group: string;
    duplicate_count: number;
}