import React, { useState } from 'react';

// X 書籤即時頁，目前只有頁面骨架，功能之後接
type Kind = 'bookmarks' | 'likes';

const TABS: Array<{ kind: Kind; label: string }> = [
  { kind: 'bookmarks', label: '書籤' },
  { kind: 'likes', label: '喜歡' },
];

const Bookmarks: React.FC = () => {
  const [kind, setKind] = useState<Kind>('bookmarks');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="t-h1 page-title">X 書籤</h1>
          <p className="page-sub">即時瀏覽 X 的書籤與喜歡，按收藏才存進 KOATAG</p>
        </div>
        <div className="v-row v-gap-2">
          <span className="t-sm txt-mute">擴充套件：偵測中…</span>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="v-row v-gap-2" style={{ marginBottom: 18 }}>
          {TABS.map((t) => (
            <button
              key={t.kind}
              className={`btn btn-sm ${t.kind === kind ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setKind(t.kind)}
            >
              {t.label}
            </button>
          ))}
          <button className="btn btn-sm btn-ghost" disabled>已收藏</button>
        </div>

        <p className="t-sm txt-mute">這裡還沒有內容</p>
      </div>
    </div>
  );
};

export { Bookmarks };
