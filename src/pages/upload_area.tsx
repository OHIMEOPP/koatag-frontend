import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Icon, Data, Dropzone, UploadForm } from 'components';
import {
    MAX_IMAGE_BATCH_COUNT,
    MAX_IMAGE_FILE_BYTES,
    MAX_IMAGE_BATCH_BYTES,
} from 'components/upload_area/Dropzone/Dropzone';
import { getUploadAreaInfo } from 'services/pageInfo/upload_page.service';
import { UploadImage } from 'services/image.service';
import { $message } from 'utils';

const Upload_area: React.FC = () => {
    const navigate = useNavigate();
    const [uploadAreaInfo, setUploadAreaInfo] = useState<Data>();

    // Dropzone state — controlled by parent so handleSubmit can read files / httpUrl
    const [files, setFiles] = useState<File[]>([]);
    const [httpUrl, setHttpUrl] = useState('');

    // Form state
    const [mainTag, setMainTag] = useState('');
    const [secondaryTag, setSecondaryTag] = useState('');
    const [ArtistTag, setArtistTag] = useState('');
    const [anotherTag, setAnotherTag] = useState('');
    const [source, setSource] = useState('');
    const [isPublic, setIsPublic] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        getUploadAreaInfo()
            .then((res) => res?.data && setUploadAreaInfo(res.data))
            .catch((e) => console.error('getUploadAreaInfo failed', e));
    }, []);

    // D.19 (2026-05-16): page-sub 顯示 app-level stricter 限制
    // PHP ini 限制（getUploadAreaInfo）若比 D.19 寬，UI 仍顯 D.19 數值
    const phpMaxFiles = uploadAreaInfo?.max_file_uploads;
    const phpMaxSizeMB = uploadAreaInfo?.upload_max_filesize_MB;
    const phpTotalSizeMB = uploadAreaInfo?.post_max_size_MB;
    const maxFiles = phpMaxFiles !== undefined
        ? Math.min(MAX_IMAGE_BATCH_COUNT, phpMaxFiles) : undefined;
    const maxSizeMB = phpMaxSizeMB !== undefined
        ? Math.min(MAX_IMAGE_FILE_BYTES / 1024 / 1024, phpMaxSizeMB) : undefined;
    const totalSizeMB = phpTotalSizeMB !== undefined
        ? Math.min(MAX_IMAGE_BATCH_BYTES / 1024 / 1024, phpTotalSizeMB) : undefined;

    const resetForm = () => {
        setFiles([]);
        setHttpUrl('');
        setMainTag('');
        setSecondaryTag('');
        setArtistTag('');
        setAnotherTag('');
        setSource('');
        setIsPublic(true);
    };

    const handleSubmit = async () => {
        if (files.length === 0 && !httpUrl.trim()) {
            $message('請先選擇檔案或輸入圖片網址', 'warning');
            return;
        }

        const formData = new FormData();
        if (files.length > 0) {
            files.forEach((f) => formData.append('uploadimg[]', f));
            formData.append('check_img_type', 'normal');
        } else if (httpUrl.trim()) {
            formData.append('uploadimgHTTP', httpUrl.trim());
        }

        if (mainTag.trim())      formData.append('mainTag', mainTag.trim());
        if (secondaryTag.trim()) formData.append('secondaryTag', secondaryTag.trim());
        if (ArtistTag.trim())    formData.append('ArtistTag', ArtistTag.trim());
        if (anotherTag.trim())   formData.append('anotherTag', anotherTag.trim());
        if (source.trim())       formData.append('source', source.trim());
        if (isPublic)            formData.append('isPublic', '1');

        setSubmitting(true);
        $message('上傳中，請稍後...');
        try {
            const response = await UploadImage(formData);
            // status 對照 (per koatag 2026-05-02 確認):
            //   1 = 成功 / 2 = 重複圖片 (不是成功) / 0 = 未上傳 / -1 = 伺服器錯誤
            if (response.status === 1) {
                $message(response.message ?? '上傳成功');
                resetForm();
            } else if (response.status === 2) {
                $message(response.message ?? '這張圖片已上傳過', 'warning');
            } else if (response.status === 0) {
                $message(response.message ?? '未收到上傳檔案', 'warning');
            } else {
                $message(response.message ?? '上傳失敗', 'error');
            }
        } catch (err: any) {
            // D.18 / D.19: backend friendly error mapping
            const status = err?.response?.status;
            const code = err?.response?.data?.error?.code;
            if (status === 415 || code === 'INVALID_MIME') {
                $message('只接受圖片檔（JPEG / PNG / GIF / WebP / HEIC / HEIF）', 'error');
            } else if (code === 'TOO_MANY_FILES') {
                $message(`一次最多上傳 ${MAX_IMAGE_BATCH_COUNT} 個圖片`, 'error');
            } else if (code === 'FILE_TOO_LARGE') {
                const limitMB = (MAX_IMAGE_FILE_BYTES / 1024 / 1024).toFixed(0);
                $message(`單檔超過 ${limitMB} MB 上限`, 'error');
            } else if (code === 'BATCH_TOO_LARGE') {
                const limitMB = (MAX_IMAGE_BATCH_BYTES / 1024 / 1024).toFixed(0);
                $message(`批次總和超過 ${limitMB} MB`, 'error');
            } else {
                $message(`上傳失敗\n${err}`, 'error');
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1 className="t-h1 page-title">上傳圖片</h1>
                    <p className="page-sub">
                        {maxSizeMB && totalSizeMB
                            ? `支援 PNG / JPG / WEBP · 單檔最大 ${maxSizeMB} MB · 批次最多 ${totalSizeMB} MB · 最多 ${maxFiles} 張`
                            : '載入限制中…'}
                    </p>
                </div>
                <div className="v-row v-gap-2">
                    <Btn variant="ghost" size="sm" onClick={() => { resetForm(); navigate('/main/image_area'); }} disabled={submitting}>
                        取消
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={handleSubmit} disabled={submitting}>
                        {submitting ? '上傳中…' : '送出'}
                    </Btn>
                </div>
            </div>

            <div className="upload-grid">
                <Dropzone
                    files={files}
                    onFilesChange={setFiles}
                    httpUrl={httpUrl}
                    onHttpUrlChange={setHttpUrl}
                    maxFiles={maxFiles}
                    maxSizeMB={maxSizeMB}
                    totalSizeMB={totalSizeMB}
                />

                <UploadForm
                    uploadAreaInfo={uploadAreaInfo}
                    mainTag={mainTag}
                    secondaryTag={secondaryTag}
                    ArtistTag={ArtistTag}
                    anotherTag={anotherTag}
                    source={source}
                    isPublic={isPublic}
                    onMainTagChange={setMainTag}
                    onSecondaryTagChange={setSecondaryTag}
                    onArtistTagChange={setArtistTag}
                    onAnotherTagChange={setAnotherTag}
                    onSourceChange={setSource}
                    onPublicToggle={() => setIsPublic((p) => !p)}
                />
            </div>
        </div>
    );
};

export { Upload_area };
