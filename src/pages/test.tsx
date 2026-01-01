import React from "react";
import "../style/test.scss";

type ImageInfoProps = {
  src: string;
  title: string;
  description: string;
  uploader: string;
  uploadDate: string;
  resolution: string;
  size: string;
};

const Test: React.FC<ImageInfoProps> = ({
  src,
  title,
  description,
  uploader,
  uploadDate,
  resolution,
  size,
}) => {
  return (
    <div className="image-info-page">
      {/* 左上角資訊卡 */}
      <div className="info-card">
        <div className="info-content">
          <h2>{title}</h2>
          <p>{description}</p>
          <div className="meta">
            <p><strong>上傳者：</strong>{uploader}</p>
            <p><strong>上傳日期：</strong>{uploadDate}</p>
            <p><strong>解析度：</strong>{resolution}</p>
            <p><strong>檔案大小：</strong>{size}</p>
          </div>
          <div className="actions">
            <button>下載圖片</button>
            <button>分享</button>
          </div>
        </div>
      </div>

      {/* 右側圖片 */}
      <div className="image-preview">
        <img src={src} alt={title} />
      </div>
    </div>
  );
};

export default Test;
