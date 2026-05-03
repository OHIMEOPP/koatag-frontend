import { TagData, ImageData, duplicateTag } from 'components'

export interface ResponseType {
    status: number;
    message: string;
    data: Data;
    result: Data
    path: string;

    count: number;
    images_Amount: number;
}

export interface TagResponseType {
    message: string;
    status: number;
    result: TagData;
}
export interface Data extends ImageData {
    max_file_uploads: number;
    post_max_size_MB: number;
    mainTags: TagData[]
    secondaryTags: TagData[];
    artistTags: TagData[];
    tags: [];
    tagsGroup: TagData[];
    upload_max_filesize_MB: number;

    duplicateTag: duplicateTag[];

    // pageMainTagAmount: [];
    // pageSecondaryTagAmount: [];
    // pageArtistTagAmount: [];
    // pageAnotherTagAmount: [];

    UncategorizedTags: TagData[];
    anotherTag_Amount: number;
    images_Amount: number;
    artist_Amount: number;
    mainTag_Amount: number;
    secondaryTag_Amount: number;
    tagsType: string[];
    tags_Amount: number;
}

export interface TagsResponseType {
    status: number;
    message: string;
    result: TagData[];
    path: string;

}

export interface ImageResponseType {
    status: number;
    message: string;
    data: ImageData[];
    meta: {
        total: number;
        page: number;
        size: number;
        total_pages: number;
    };
}