import React, { useEffect, useState } from 'react';
import { Icon } from 'components';
import { pingExt, getXSession } from 'services/bookmarkExt';

// X 書籤即時頁
type Kind = 'bookmarks' | 'likes';
type ExtState = 'checking' | 'missing' | 'ready';
type XState = 'checking' | 'loggedIn' | 'loggedOut';

const TABS: Array<{ kind: Kind; label: string }> = [
  { kind: 'bookmarks', label: '書籤' },
  { kind: 'likes', label: '喜歡' },
];

const Bookmarks: React.FC = () => {
  const [kind, setKind] = useState<Kind>('bookmarks');
  const [extState, setExtState] = useState<ExtState>('checking');
  const [extVersion, setExtVersion] = useState('');
  const [xState, setXState] = useState<XState>('checking');
  const [xUserId, setXUserId] = useState('');

  const detect = async () => {
    setExtState('checking');
    setXState('checking');

    const pong = await pingExt();
    if (!pong) {
      setExtState('missing');
      return;
    }
    setExtState('ready');
    setExtVersion(pong.version);

    const session = await getXSession();
    if (!session || !session.loggedIn) {
      setXState('loggedOut');
      return;
    }
    setXState('loggedIn');
    setXUserId(session.xUserId || '');
  };

  useEffect(() => {
    detect();
  }, []);

  const openXLogin = () => {
    window.open('https://x.com/login', '_blank', 'noopener');
  };

  // 偵測中不能再按重新偵測
  let checking = false;
  if (extState === 'checking') {
    checking = true;
  }
  if (extState === 'ready' && xState === 'checking') {
    checking = true;
  }

  let extDot = '';
  let extText = '擴充套件：偵測中…';
  if (extState === 'missing') {
    extDot = 'bad';
    extText = '沒有偵測到擴充套件';
  }
  if (extState === 'ready') {
    extDot = 'ok';
    extText = '擴充套件 v' + extVersion;
  }

  let xDot = '';
  let xText = 'X：偵測中…';
  if (xState === 'loggedIn') {
    xDot = 'ok';
    xText = 'X 已登入';
  }
  if (xState === 'loggedOut') {
    xDot = 'bad';
    xText = 'X 未登入';
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="t-h1 page-title">X 書籤</h1>
          <p className="page-sub">即時瀏覽 X 的書籤與喜歡，按收藏才存進 KOATAG</p>
        </div>
        <div className="bm-status">
          <span className="bm-status-item">
            <span className={`bm-dot ${extDot}`} />
            {extText}
          </span>
          {extState === 'ready' && (
            <span className="bm-status-item" title={xUserId ? 'X 帳號 id ' + xUserId : undefined}>
              <span className={`bm-dot ${xDot}`} />
              {xText}
            </span>
          )}
          {xState === 'loggedOut' && (
            <button className="btn btn-sm btn-primary" onClick={openXLogin}>登入 X</button>
          )}
          {extState === 'missing' ? (
            // 擴充套件只在頁面載入時注入，裝好後要重新整理才偵測得到
            <button className="btn btn-sm btn-ghost" onClick={() => window.location.reload()}>
              <Icon.refresh size={13} /> 重新整理
            </button>
          ) : (
            <button className="btn btn-sm btn-ghost" onClick={detect} disabled={checking}>
              <Icon.refresh size={13} /> 重新偵測
            </button>
          )}
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

        {extState === 'missing' && (
          <div className="bm-notice">
            要瀏覽 X 書籤，這台電腦的瀏覽器需要先安裝 KOATAG 書籤擴充套件：
            <ol>
              <li>下載擴充套件 zip 並解壓縮</li>
              <li>開啟 <code>chrome://extensions</code>，打開右上角「開發人員模式」</li>
              <li>按「載入未封裝項目」，選解壓縮後的資料夾</li>
              <li>回到這一頁按「重新整理」</li>
            </ol>
          </div>
        )}

        {xState === 'loggedOut' && (
          <div className="bm-notice">
            請先在這個瀏覽器登入 X。按右上角「登入 X」會開新分頁到 X 官方登入頁，帳密只在 X 輸入。登入後回到這一頁按「重新偵測」。
          </div>
        )}

        {xState === 'loggedIn' && (
          <p className="t-sm txt-mute">這裡還沒有內容</p>
        )}
      </div>
    </div>
  );
};

export { Bookmarks };
