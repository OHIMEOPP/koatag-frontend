import React, { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFile, downloadUrl, DriveFile } from "services/drive.service";
import { mapDriveError } from "services/drive.errorMap";
import { useDriveStreamUrl } from "hooks/useDriveStreamUrl";
import { formatBytes, getMimeIconText, VideoPlayer } from "components/drive";
import { FullscreenViewer } from "components/FullscreenViewer/FullscreenViewer";
import { Icon } from "components/Icon";
import type { ImageData } from "components/types/images";

/**
 * /main/drive/file/:id — Drive 單檔詳情頁（spec §1.1 + §2 + v2-X (b) image_data tag readonly）
 *
 * - mime 分流：image/* → ImagePreview (click → FullscreenViewer + Magnifier loupe)
 *              video/* → VideoPlayer (aspect-ratio container 防 layout shift, wiki #302 finding E)
 *              其他    → GenericPreview (icon + mime)
 * - sidebar：File 基本 meta (size / mime / created / updated) + download button
 * - image_data tag block (b) readonly：v2-X 連結到 image_datas 時用 ?include=image_data 一次抓
 *   顯示 mainTag/secondaryTag/ArtistTag/anotherTag；編輯請至 image system
 * - crossOrigin="anonymous"：對齊 backend §17.7c CORS contract（koatag #301 verify pass）
 *   讓未來 canvas drawImage 不 taint
 * - retry button on error（wiki #302 finding F）
 */
const DriveFilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const fileId = id ? Number(id) : NaN;

  const [file, setFile] = useState<DriveFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fsOpen, setFsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (Number.isNaN(fileId)) {
      setError("檔案 ID 無效");
      setLoading(false);
      return;
    }
    let aborted = false;
    setLoading(true);
    setError(null);
    getFile(fileId, { include: "image_data" })
      .then((f) => {
        if (aborted) return;
        setFile(f);
        setLoading(false);
      })
      .catch((e) => {
        if (aborted) return;
        setError(mapDriveError(e));
        setLoading(false);
      });
    return () => {
      aborted = true;
    };
  }, [fileId, refreshKey]);

  const goBack = useCallback(() => {
    if (file?.folder_id != null) {
      navigate(`/main/drive/folder/${file.folder_id}`);
    } else {
      navigate("/main/drive");
    }
  }, [file, navigate]);

  const handleDownload = useCallback(async () => {
    if (!file) return;
    try {
      const url = await downloadUrl(file.id);
      window.open(url, "_blank", "noopener");
    } catch (e) {
      setError(mapDriveError(e));
    }
  }, [file]);

  if (loading) {
    return (
      <div className="drive-file-page">
        <BackBtn onClick={goBack} />
        <div className="drive-loading">載入中…</div>
      </div>
    );
  }
  if (error || !file) {
    return (
      <div className="drive-file-page">
        <BackBtn onClick={goBack} />
        <div className="drive-error">
          <span>{error ?? "檔案不存在"}</span>
          <button
            type="button"
            className="drive-modal-btn"
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            <Icon.refresh size={14} /> 重試
          </button>
        </div>
      </div>
    );
  }

  const isImage = file.mime.startsWith("image/");
  const isVideo = file.mime.startsWith("video/");

  return (
    <div className="drive-file-page">
      <div className="drive-file-header">
        <BackBtn onClick={goBack} />
        <div className="drive-file-name" title={file.name}>
          {file.name}
        </div>
      </div>
      <div className="drive-file-content">
        <div className="drive-file-preview">
          {isImage ? (
            <ImagePreview file={file} onClickToFullscreen={() => setFsOpen(true)} />
          ) : isVideo ? (
            <div className="drive-video-container">
              <VideoPlayer fileId={file.id} name={file.name} />
            </div>
          ) : (
            <GenericPreview file={file} />
          )}
        </div>
        <aside className="drive-file-sidebar">
          <FileMeta file={file} onDownload={handleDownload} />
          {file.image_data && <ImageDataTagBlock data={file.image_data} />}
        </aside>
      </div>
      {isImage && (
        <ImageFullscreen
          fileId={file.id}
          name={file.name}
          open={fsOpen}
          onClose={() => setFsOpen(false)}
        />
      )}
    </div>
  );
};

const BackBtn: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button type="button" className="drive-file-back" onClick={onClick}>
    <Icon.chevronLeft size={14} />
    返回
  </button>
);

/**
 * Progressive thumb → stream（v2 polish T13 finding A）：
 * - 先 render 600px thumb（cache 命中可瞬間顯示）
 * - 背景同時 preload 原圖 stream URL
 * - stream onLoad 觸發 swap，user 看到 high-res 版本
 *
 * thumb_path null 的圖（backend gen 失敗等）直接走 stream。
 */
const ImagePreview: React.FC<{
  file: DriveFile;
  onClickToFullscreen: () => void;
}> = ({ file, onClickToFullscreen }) => {
  const hasThumb = !!file.thumb_path;
  const { url: thumbUrl } = useDriveStreamUrl(hasThumb ? file.id : null, "thumb");
  const { url: streamUrl, loading, error } = useDriveStreamUrl(file.id, "stream");
  const [streamReady, setStreamReady] = useState(false);

  const displayUrl = streamReady && streamUrl ? streamUrl : (thumbUrl ?? streamUrl);

  // thumb 不可用時 fallback stream loading 邏輯
  if (!displayUrl) {
    if (loading) return <div className="drive-loading">載入中…</div>;
    if (error) return <div className="drive-error">{error}</div>;
    return null;
  }

  return (
    <div
      className="drive-img-preview"
      onClick={onClickToFullscreen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClickToFullscreen();
      }}
    >
      <img
        src={displayUrl}
        alt={file.name}
        crossOrigin="anonymous"
        className={!streamReady && hasThumb ? "drive-img-loading-blur" : ""}
      />
      {/* 背景 preloader：載完高解析 stream 後 swap */}
      {streamUrl && !streamReady && hasThumb && (
        <img
          src={streamUrl}
          alt=""
          crossOrigin="anonymous"
          style={{ display: "none" }}
          onLoad={() => setStreamReady(true)}
        />
      )}
      <div className="drive-img-overlay">點擊放大檢視</div>
    </div>
  );
};

const GenericPreview: React.FC<{ file: DriveFile }> = ({ file }) => (
  <div className="drive-generic-preview">
    <div className="drive-generic-icon">{getMimeIconText(file.mime)}</div>
    <div className="drive-generic-mime">{file.mime}</div>
  </div>
);

const FileMeta: React.FC<{
  file: DriveFile;
  onDownload: () => void;
}> = ({ file, onDownload }) => (
  <div className="drive-file-meta">
    <h3>檔案資訊</h3>
    <dl>
      <dt>大小</dt>
      <dd>{formatBytes(file.size_bytes)}</dd>
      <dt>類型</dt>
      <dd>{file.mime}</dd>
      <dt>建立</dt>
      <dd>{new Date(file.created_at).toLocaleString()}</dd>
      <dt>修改</dt>
      <dd>{new Date(file.updated_at).toLocaleString()}</dd>
    </dl>
    <button
      type="button"
      className="drive-modal-btn drive-modal-btn-primary drive-file-download"
      onClick={onDownload}
    >
      <Icon.download size={14} />
      下載
    </button>
  </div>
);

const ImageDataTagBlock: React.FC<{ data: ImageData }> = ({ data }) => {
  const sections: Array<{ label: string; tags: string[] | null | undefined }> = [
    { label: "Main", tags: data.mainTag },
    { label: "Sub", tags: data.secondaryTag },
    { label: "Artist", tags: data.ArtistTag },
    { label: "Other", tags: data.anotherTag },
  ];
  return (
    <div className="drive-file-tags">
      <h3>已連結圖片標籤</h3>
      <div className="drive-file-tags-note">readonly · 編輯請至 image system</div>
      {sections.map((s) => (
        <div key={s.label} className="drive-file-tag-row">
          <span className="drive-file-tag-label">{s.label}</span>
          <span className="drive-file-tag-values">
            {s.tags && s.tags.length ? (
              s.tags.join("、")
            ) : (
              <span className="drive-file-tag-empty">無</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
};

const ImageFullscreen: React.FC<{
  fileId: number;
  name: string;
  open: boolean;
  onClose: () => void;
}> = ({ fileId, name, open, onClose }) => {
  // 只在 open 時才簽 sig 避免閒置 POST（v2 bulk-sign 範圍另議）
  const { url } = useDriveStreamUrl(open ? fileId : null, "stream");
  if (!open || !url) return null;
  return (
    <FullscreenViewer
      src={url}
      alt={name}
      open={open}
      onClose={onClose}
      crossOrigin="anonymous"
    />
  );
};

export default DriveFilePage;
export { DriveFilePage };
