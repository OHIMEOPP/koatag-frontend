import React, { useState } from 'react';
import { Icon } from 'components';

// Mock data — placeholder until backend ships an operation_logs endpoint.
// Mirrors the original design's HISTORY shape (claude_design_整合前ui/koatag-data.jsx).
type BadgeKind = 'create' | 'update' | 'delete' | 'tag';
type DotColor = '' | 'g' | 'b' | 'r';

interface HistoryEvent {
  time: string;
  color: DotColor;
  badge: [BadgeKind, string];
  text: string;
  target: string;
  thumb?: string;
}

const HISTORY: HistoryEvent[] = [
  { time: '今天 · 14:32',     color: '',  badge: ['update', '已更新標籤'],  text: '為 ',          target: 'hatsune_miku_winter.jpg', thumb: 'https://picsum.photos/seed/h0/80' },
  { time: '今天 · 11:08',     color: 'g', badge: ['create', '已上傳'],     text: '上傳 12 張圖到圖庫', target: '', thumb: 'https://picsum.photos/seed/h1/80' },
  { time: '今天 · 09:14',     color: 'b', badge: ['tag',    '新建標籤'],   text: '建立角色標籤 ',  target: 'Frieren' },
  { time: '昨天 · 22:41',     color: '',  badge: ['update', '已編輯'],     text: '變更可見度 ',    target: 'momoco_archive_07.jpg', thumb: 'https://picsum.photos/seed/h2/80' },
  { time: '昨天 · 19:55',     color: 'r', badge: ['delete', '已移除'],     text: '刪除標籤 ',      target: '#temp-batch' },
  { time: '昨天 · 16:20',     color: 'b', badge: ['update', '已重新命名'], text: '重新命名系列 ',  target: 'hololive → hololive JP' },
  { time: '4/30 · 08:12',     color: 'g', badge: ['create', '已上傳'],     text: '批次上傳 ',      target: '38 張圖片', thumb: 'https://picsum.photos/seed/h3/80' },
  { time: '4/29 · 21:03',     color: '',  badge: ['update', '已更新標籤'],  text: '更新標籤於 ',    target: 'komi_san_lap.jpg', thumb: 'https://picsum.photos/seed/h4/80' },
  { time: '4/29 · 14:48',     color: '',  badge: ['tag',    '已合併標籤'], text: '合併 ',         target: 'miku → Hatsune Miku' },
];

const FILTER_TABS = ['全部', '上傳', '標籤編輯', '刪除', '重新命名'] as const;

const History: React.FC = () => {
  const [activeFilter, setActiveFilter] = useState(0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="t-h1 page-title">瀏覽紀錄</h1>
          <p className="page-sub">記錄每次圖庫變更 — 過去 90 天</p>
        </div>
        <div className="v-row v-gap-2">
          <button className="btn btn-ghost"><Icon.filter size={13} /> 篩選</button>
          <button className="btn btn-ghost"><Icon.download size={13} /> 匯出</button>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="v-row v-gap-2" style={{ marginBottom: 18 }}>
          {FILTER_TABS.map((t, i) => (
            <button
              key={t}
              className={`btn btn-sm ${i === activeFilter ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveFilter(i)}
            >
              {t}
            </button>
          ))}
          <div className="spacer" />
          <span className="t-sm txt-mute">顯示 9 筆，共 142 筆事件</span>
        </div>

        <div className="timeline">
          {HISTORY.map((h, i) => (
            <div key={i} className="tl-item">
              <div className={`tl-dot ${h.color}`} />
              <div className="tl-card">
                <span className="tl-time">{h.time}</span>
                <div className="tl-action">
                  <span className={`badge ${h.badge[0]}`}>{h.badge[1]}</span>
                  <span style={{ color: 'var(--color-text-secondary)' }}>{h.text}</span>
                  {h.target && <b style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{h.target}</b>}
                </div>
                {h.thumb && (
                  <div className="tl-thumb" style={{ backgroundImage: `url(${h.thumb})` }} />
                )}
                <div className="tl-actions">
                  <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="view">
                    <Icon.eye size={13} />
                  </button>
                  <button className="icon-btn" style={{ width: 30, height: 30 }} aria-label="restore">
                    <Icon.refresh size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export { History };
