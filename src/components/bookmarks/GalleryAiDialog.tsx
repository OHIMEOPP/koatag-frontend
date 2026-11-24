import React from 'react';
import { Icon } from 'components/Icon';
import { useDialogEsc } from 'hooks/useDialogEsc';

type Props = {
  count: number;
  // 黑板的圖沒有貼文作者，不顯示自動填作者那句
  hideArtistNote?: boolean;
  onPick: (useAi: boolean) => void;
  onClose: () => void;
};

// 存進圖庫前問要不要 AI 辨識，只填其他標籤
export const GalleryAiDialog: React.FC<Props> = ({ count, hideArtistNote, onPick, onClose }) => {
  useDialogEsc(onClose);

  return (
    <div className="drive-modal-overlay" onClick={onClose}>
      <div className="drive-modal" onClick={(e) => e.stopPropagation()} role="dialog">
        <div className="drive-modal-title">要用 AI 辨識標籤嗎？</div>

        <div className="bm-notice">
          準備把 {count} 張圖存進圖庫。AI 辨識的結果只會填進「其他標籤」，人物、團體不會動
          {hideArtistNote ? '。' : '，作者照樣自動填貼文帳號。'}
          每張圖要多等幾秒。
        </div>

        <div className="drive-modal-actions">
          <button type="button" className="drive-modal-btn" onClick={onClose}>取消</button>
          <button type="button" className="drive-modal-btn" onClick={() => onPick(false)}>不用，直接存</button>
          <button type="button" className="drive-modal-btn drive-modal-btn-primary" onClick={() => onPick(true)}>
            <Icon.star size={13} /> AI 辨識後存
          </button>
        </div>
      </div>
    </div>
  );
};
