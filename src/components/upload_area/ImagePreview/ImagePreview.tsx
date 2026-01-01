import { useRef } from "react";

interface ImagePreviewProps {
    maxFiles: number | undefined;
    maxFileSizeMB: number | undefined;
    totalMaxSizeMB: number | undefined;
    onFilesChange?: (files: FileList) => void;
}

const ImagePreview: React.FC<ImagePreviewProps> = ({ maxFiles, maxFileSizeMB, totalMaxSizeMB, onFilesChange }) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const fileAmountRef = useRef<HTMLDivElement>(null);

    const MaxFileSizeMB = maxFileSizeMB ?? 0;
    const TotalMaxSizeMB = totalMaxSizeMB ?? 0

    const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        let totalSize = 0;
        previewRef.current!.innerHTML = '';
        Array.from(files).forEach((file, index) => {
            totalSize += file.size;
            if (file.size / 1024 / 1024 > MaxFileSizeMB) {
                alert(`${file.name} 超過單文件上限 ${maxFileSizeMB} MB`);
                return;
            }
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            img.onload = () => URL.revokeObjectURL(img.src);
            previewRef.current!.appendChild(img);
        });

        if (totalSize / 1024 / 1024 > TotalMaxSizeMB) {
            alert(`檔案總大小超過 ${totalMaxSizeMB} MB`);
            previewRef.current!.innerHTML = '';
            return;
        }

        if (fileAmountRef.current) fileAmountRef.current.textContent = `圖片數量: ${files.length}`;
        onFilesChange?.(files);
    }

    return (
        <div className="image-preview">
            <div ref={previewRef} className="_img" id="_img" />
            <input type="file" ref={inputRef} multiple onChange={handleFiles} accept="image/*" />
            <div ref={fileAmountRef}>圖片數量: 當前無圖片</div>
        </div>
    );
};

export { ImagePreview }