import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Btn, Icon, Data } from 'components';
import { getUploadAreaInfo } from 'services/pageInfo/upload_page.service';

// Step 8.2 — v3 layout shell only.
// dropzone / form / submit 等子步驟 8.3-8.6 接入。
const Upload_area: React.FC = () => {
    const navigate = useNavigate();
    const [uploadAreaInfo, setUploadAreaInfo] = useState<Data>();

    useEffect(() => {
        getUploadAreaInfo()
            .then((res) => res?.data && setUploadAreaInfo(res.data))
            .catch((e) => console.error('getUploadAreaInfo failed', e));
    }, []);

    const maxFiles = uploadAreaInfo?.max_file_uploads;
    const maxSizeMB = uploadAreaInfo?.upload_max_filesize_MB;
    const totalSizeMB = uploadAreaInfo?.post_max_size_MB;

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
                    <Btn variant="ghost" size="sm" onClick={() => navigate('/main/image_area')}>
                        取消
                    </Btn>
                    <Btn variant="primary" size="sm" icon={<Icon.upload size={12} />} onClick={() => alert('送出 — 等 Step 8.6 接入')}>
                        送出
                    </Btn>
                </div>
            </div>

            <div className="upload-grid">
                <div className="dropzone">
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [8.3] dropzone — drag/drop + 選檔 + 預覽 / [8.4] URL 抓取
                    </div>
                </div>

                <div className="card upload-form">
                    <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>
                        [8.5] 4 個 tag input + isPublic + source — 用 v3 TagInput 取代手刻 #demo
                    </div>
                </div>
            </div>
        </div>
    );
};

export { Upload_area };
