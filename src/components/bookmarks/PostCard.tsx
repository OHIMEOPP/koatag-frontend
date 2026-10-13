import React from 'react';
import { Icon } from 'components/Icon';
import { XItem } from 'services/bookmarkExt';

type Props = {
  item: XItem;
  saved: boolean;
  saving: boolean;
  onSave: (item: XItem) => void;
  onUnsave: (item: XItem) => void;
  // 已收藏沒存頭像，不顯示
  showAvatar?: boolean;
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

export const PostCard: React.FC<Props> = ({ item, saved, saving, onSave, onUnsave, showAvatar = true }) => {
  const media = item.media.slice(0, 4);

  const onClickSave = () => {
    if (saved) {
      onUnsave(item);
      return;
    }
    onSave(item);
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
              <div className="bm-media-cell" key={i}>
                <img src={m.url} loading="lazy" alt="" />
                {m.type === 'video' && <span className="bm-media-badge">影片</span>}
                {m.type === 'animated_gif' && <span className="bm-media-badge">GIF</span>}
              </div>
            ))}
          </div>
        )}

        <div className="bm-post-foot">
          {item.url ? (
            <a href={item.url} target="_blank" rel="noopener noreferrer">在 X 上查看</a>
          ) : (
            <span />
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
    </article>
  );
};
