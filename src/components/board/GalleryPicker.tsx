import React, { useEffect, useState } from 'react';
import { ImageData } from 'components';
import { useDialogEsc } from 'hooks/useDialogEsc';
import { TagSearchBox } from 'components/TagSearchBox';
import { getImageList } from 'services/image.service';
import { galleryThumbUrl } from 'services/board.service';

type Props = {
  onPick: (images: ImageData[]) => void;
  onClose: () => void;
};

const PAGE_SIZE = 30;

// 從圖庫選圖加上黑板，可搜標籤、可多選，換頁時已選的保留
export const GalleryPicker: React.FC<Props> = ({ onPick, onClose }) => {
  useDialogEsc(onClose);

  const [images, setImages] = useState<ImageData[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [tag, setTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<ImageData[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: { page: number; size: number; tag?: string } = { page: page, size: PAGE_SIZE };
    if (tag) {
      params.tag = tag;
    }
    getImageList(params)
      .then((response) => {
        if (cancelled) {
          return;
        }
        setImages(response.data || []);
        setTotalPages(response.meta ? response.meta.total_pages : 0);
      })
      .catch(() => {
        if (!cancelled) {
          setImages([]);
          setTotalPages(0);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, tag]);

  // 跟頂端搜尋框同一套，空白送出顯示全部
  const onSearch = (query: string) => {
    setPage(1);
    setTag(query);
  };

  const isPicked = (image: ImageData) => {
    for (const p of picked) {
      if (p.id === image.id) {
        return true;
      }
    }
    return false;
  };

  const togglePick = (image: ImageData) => {
    if (isPicked(image)) {
      setPicked(picked.filter((p) => p.id !== image.id));
    } else {
      setPicked([...picked, image]);
    }
  };

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal board-picker" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">從圖庫加入</div>

        <div className="board-picker-search">
          <TagSearchBox onSearch={onSearch} allowEmpty autoFocus placeholder="搜尋標籤、人物或作者，留空按 Enter 顯示全部" />
        </div>

        <div className="board-picker-grid">
          {loading && <div className="board-picker-empty">載入中…</div>}
          {!loading && images.length === 0 && <div className="board-picker-empty">沒有圖片</div>}
          {!loading && images.map((image) => (
            <button
              type="button"
              key={image.id}
              className={`board-picker-cell ${isPicked(image) ? 'picked' : ''}`}
              style={{ backgroundImage: `url(${galleryThumbUrl(image)})` }}
              onClick={() => togglePick(image)}
            />
          ))}
        </div>

        <div className="board-picker-pager">
          <button type="button" className="drive-modal-btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
            上一頁
          </button>
          <span>{page} / {totalPages || 1}</span>
          <button type="button" className="drive-modal-btn" disabled={page >= totalPages || loading} onClick={() => setPage(page + 1)}>
            下一頁
          </button>
        </div>

        <div className="drive-modal-actions">
          <button type="button" className="drive-modal-btn" onClick={onClose}>取消</button>
          <button
            type="button"
            className="drive-modal-btn drive-modal-btn-primary"
            disabled={picked.length === 0}
            onClick={() => onPick(picked)}
          >
            加入 {picked.length} 張
          </button>
        </div>
      </div>
    </div>
  );
};
