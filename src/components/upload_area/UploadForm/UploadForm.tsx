import { Data } from "components/types/respones";
import { useRef } from "react";
import { UploadImage } from "services/image.service";
import { ImagePreview } from "../ImagePreview/ImagePreview";
import { TagInput } from "../TagInput/TagInput";

const UploadForm: React.FC<{ uploadAreaInfo: Data | undefined }> = ({ uploadAreaInfo }) => {
    const formRef = useRef<HTMLFormElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const formData = new FormData(formRef.current!);
        const res = await UploadImage(formData);
        alert(res.message);
        formRef.current!.reset();
    }

    return (
        <form ref={formRef} onSubmit={handleSubmit}>
            <ImagePreview
                maxFiles={uploadAreaInfo?.max_file_uploads}
                maxFileSizeMB={uploadAreaInfo?.upload_max_filesize_MB}
                totalMaxSizeMB={uploadAreaInfo?.post_max_size_MB}
            />
            <TagInput label="人物" suggestions={uploadAreaInfo?.mainTags || []} onChange={() => { }} />
            <TagInput label="團體" suggestions={uploadAreaInfo?.secondaryTags || []} onChange={() => { }} />
            <TagInput label="作者" suggestions={uploadAreaInfo?.artistTags || []} onChange={() => { }} />
            <button type="submit">上傳</button>
        </form>
    );
};

export { UploadForm }