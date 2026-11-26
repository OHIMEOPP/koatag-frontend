import React, { useState } from 'react';
import { isDesktop } from 'utils/desktop';
import { invoke } from '@tauri-apps/api/core';
import { Icon } from 'components/Icon';
import { XItem } from 'services/bookmarkExt';
import { GalleryResult, aiAnotherTags } from 'services/bookmark.service';
import { GalleryAiDialog } from 'components/bookmarks/GalleryAiDialog';
import { $message } from 'utils';

type Props = {
  item: XItem;
  saved: boolean;
  saving: boolean;
  onSave: (item: XItem) => void;
  onUnsave: (item: XItem) => void;
  onToGallery: (item: XItem, indexes: number[] | null, anotherTag: string | null) => Promise<GalleryResult[]>;
  // 已收藏沒存頭像，不顯示
  showAvatar?: boolean;
};

const GALLERY_BADGE: Record<string, string> = {
  saved: '已存進圖庫',
  exists: '已在圖庫',
  failed: '存圖失敗',
};

// 跟 X 一樣的相對時間，一天內顯示多久前
const formatTime = (createdAt: string) => {
  if (!createdAt) {
    return '';
  }
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) {
    return '';
  }
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) {
    return '剛剛';
  }
  if (diff < 3600) {
    return Math.floor(diff / 60) + ' 分鐘';
  }
  if (diff < 86400) {
    return Math.floor(diff / 3600) + ' 小時';
  }
  if (d.getFullYear() === new Date().getFullYear()) {
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日';
};

const fullTime = (createdAt: string) => {
  const d = new Date(createdAt);
  if (!createdAt || isNaN(d.getTime())) {
    return undefined;
  }
  return d.toLocaleString('zh-TW', { hour12: false });
};

export const PostCard: React.FC<Props> = ({ item, saved, saving, onSave, onUnsave, onToGallery, showAvatar = true }) => {
  const media = item.media.slice(0, 4);
  // 勾選要存的圖，沒勾就存全部
  const [picked, setPicked] = useState<number[]>([]);
  // 每張圖存圖結果，key 是第幾張
  const [galleryStatus, setGalleryStatus] = useState<Record<number, string>>({});
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [aiProgress, setAiProgress] = useState('');
  const [showAiDialog, setShowAiDialog] = useState(false);

  let photoCount = 0;
  for (const m of media) {
    if (m.type === 'photo') {
      photoCount++;
    }
  }

  const togglePick = (index: number) => {
    if (media[index].type !== 'photo' || galleryBusy) {
      return;
    }
    if (picked.includes(index)) {
      setPicked(picked.filter((i) => i !== index));
      return;
    }
    setPicked(picked.concat(index));
  };

  // 要存的是勾選的，沒勾就是全部圖片
  const targetIndexes = () => {
    if (picked.length > 0) {
      return picked;
    }
    const all: number[] = [];
    for (let i = 0; i < media.length; i++) {
      if (media[i].type === 'photo') {
        all.push(i);
      }
    }
    return all;
  };

  const onClickGallery = () => {
    if (galleryBusy) {
      return;
    }
    setShowAiDialog(true);
  };

  const runGallery = async (useAi: boolean) => {
    setShowAiDialog(false);
    setGalleryBusy(true);
    let results: GalleryResult[] = [];
    let aiFailedCount = 0;

    if (!useAi) {
      try {
        results = await onToGallery(item, picked.length > 0 ? picked : null, null);
      } catch (e) {
        $message('存進圖庫失敗，稍後再試', 'error');
        setGalleryBusy(false);
        return;
      }
    }

    // 每張圖標籤不同，一張一張辨識一張一張存
    if (useAi) {
      const indexes = targetIndexes();
      for (let n = 0; n < indexes.length; n++) {
        const i = indexes[n];
        setAiProgress('AI 辨識 ' + (n + 1) + '/' + indexes.length);
        let tags: string | null = null;
        try {
          tags = await aiAnotherTags(media[i].url);
        } catch (e) {
          // 辨識失敗照樣存，只是沒有標籤
          aiFailedCount++;
        }
        try {
          const one = await onToGallery(item, [i], tags || null);
          results = results.concat(one);
        } catch (e) {
          results.push({ index: i, status: 'failed', image_id: null, reason: 'request_failed' });
        }
      }
      setAiProgress('');
    }

    const next = { ...galleryStatus };
    let savedCount = 0;
    let existsCount = 0;
    let failedCount = 0;
    for (const r of results) {
      if (r.status === 'saved') {
        savedCount++;
      }
      if (r.status === 'exists') {
        existsCount++;
      }
      if (r.status === 'failed') {
        failedCount++;
      }
      if (r.status !== 'skipped') {
        next[r.index] = r.status;
      }
    }
    setGalleryStatus(next);
    setPicked([]);
    setGalleryBusy(false);

    let text = '存進圖庫 ' + savedCount + ' 張';
    if (existsCount > 0) {
      text = text + '，' + existsCount + ' 張已存入過';
    }
    if (failedCount > 0) {
      text = text + '，' + failedCount + ' 張失敗';
    }
    if (aiFailedCount > 0) {
      text = text + '，' + aiFailedCount + ' 張 AI 辨識失敗未加標籤';
    }
    $message(text, failedCount > 0 || aiFailedCount > 0 ? 'warning' : 'info');
  };

  let galleryLabel = '存進圖庫';
  if (picked.length > 0) {
    galleryLabel = '存 ' + picked.length + ' 張進圖庫';
  }
  if (galleryBusy) {
    galleryLabel = '存圖中…';
  }
  if (aiProgress) {
    galleryLabel = aiProgress;
  }

  const onClickSave = () => {
    if (saved) {
      onUnsave(item);
      return;
    }
    onSave(item);
  };

  const openXForm = async (X_URL: string) => {
    try {
      await invoke('open_x_form', { url: X_URL });
    } catch {
      $message('無法開啟 X 貼文，請稍後再試', 'error');
    }
  };

  let saveLabel = '收藏';
  if (saved) {
    saveLabel = '已收藏';
  }
  if (saving) {
    saveLabel = '處理中…';
  }

  return (
    <article className={`bm-post ${showAvatar ? '' : 'no-avatar'}`}>
      {showAvatar && item.author && item.author.avatar && (
        <img className="bm-avatar" src={item.author.avatar} alt="" />
      )}
      {showAvatar && !(item.author && item.author.avatar) && (
        <div className="bm-avatar" />
      )}

      <div className="bm-post-body">
        <div className="bm-post-head">
          <span className="bm-post-name">{item.author ? item.author.name : '（無作者資料）'}</span>
          {item.author && <span className="bm-post-sub">@{item.author.screenName}</span>}
          <span className="bm-post-sub" title={fullTime(item.createdAt)}>· {formatTime(item.createdAt)}</span>
        </div>

        {item.text && <div className="bm-post-text">{item.text}</div>}

        {media.length > 0 && (
          <div className={`bm-media n${media.length}`}>
            {media.map((m, i) => (
              <div
                className={`bm-media-cell ${m.type === 'photo' ? 'pickable' : ''} ${picked.includes(i) ? 'picked' : ''}`}
                key={i}
                onClick={() => togglePick(i)}
              >
                <img src={m.url} loading="lazy" alt="" />
                {m.type === 'video' && <span className="bm-media-badge">影片</span>}
                {m.type === 'animated_gif' && <span className="bm-media-badge">GIF</span>}
                {m.type === 'photo' && (
                  <span className="bm-pick">{picked.includes(i) && <Icon.check size={12} />}</span>
                )}
                {galleryStatus[i] && (
                  <span className={`bm-media-badge ${galleryStatus[i]}`}>{GALLERY_BADGE[galleryStatus[i]]}</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="bm-post-foot">
          {item.url ? (
            isDesktop() ? (
              <button className="btn btn-sm btn-outline" onClick={() => { if (item.url) openXForm(item.url); }}>
                在 X 上查看
              </button>
            ) : (
              <a href={item.url} target="_blank" rel="noopener noreferrer">
                在 X 上查看
              </a>
            )
          ) : (
            <span />
          )}
          <div className="bm-post-actions">
            {photoCount > 0 && (
              <button className="bm-gallery" onClick={onClickGallery} disabled={galleryBusy}>
                <Icon.image size={14} />
                <span>{galleryLabel}</span>
              </button>
            )}
            <button
              className={`bm-save ${saved ? 'saved' : ''}`}
              onClick={onClickSave}
              disabled={saving}
            >
              {saved ? <Icon.bookmarkFilled size={14} /> : <Icon.bookmark size={14} />}
              <span className="bm-save-label">{saveLabel}</span>
              {/* 已收藏滑過去改顯示取消收藏 */}
              {saved && !saving && <span className="bm-save-cancel">取消收藏</span>}
            </button>
          </div>
        </div>
      </div>

      {showAiDialog && (
        <GalleryAiDialog
          count={targetIndexes().length}
          onPick={runGallery}
          onClose={() => setShowAiDialog(false)}
        />
      )}
    </article>
  );
};
