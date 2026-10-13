import React, { useEffect, useRef, useState } from 'react';
import { Icon } from 'components';
import { PostCard } from 'components/bookmarks/PostCard';
import { pingExt, getXSession, fetchXPage, XItem, XKind } from 'services/bookmarkExt';
import { getExtensionVersion, downloadExtension, isOlderVersion, saveBookmark } from 'services/bookmark.service';
import { $message } from 'utils';

// X 書籤即時頁
type ExtState = 'checking' | 'missing' | 'ready';
type XState = 'checking' | 'loggedIn' | 'loggedOut';

const TABS: Array<{ kind: XKind; label: string }> = [
  { kind: 'bookmarks', label: '書籤' },
  { kind: 'likes', label: '喜歡' },
];

// 擴充套件回傳的錯誤代碼
const MESSAGES: Record<string, string> = {
  x_not_logged_in: '請先在這個瀏覽器登入 X',
  x_rate_limited: 'X 暫時限制請求，稍後再試',
  x_api_changed: 'X 改版了，等待更新設定',
  x_blocked: 'X 拒絕了請求',
  x_error: '暫時無法連線 X，稍後再試',
  extension_error: '擴充套件沒有回應，請重新整理頁面',
};

const Bookmarks: React.FC = () => {
  const [kind, setKind] = useState<XKind>('bookmarks');
  const [items, setItems] = useState<XItem[]>([]);
  const [message, setMessage] = useState('');
  const [messageBad, setMessageBad] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());

  // 載入流程要讀到最新值，用 ref 存
  const kindRef = useRef<XKind>('bookmarks');
  const cursorRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  const finishedRef = useRef(false);
  const countRef = useRef(0);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [extState, setExtState] = useState<ExtState>('checking');
  const [extVersion, setExtVersion] = useState('');
  const [xState, setXState] = useState<XState>('checking');
  const [xUserId, setXUserId] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [downloading, setDownloading] = useState(false);

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
    // 拿不到最新版本就不提示更新，不影響其他功能
    getExtensionVersion()
      .then((version) => setLatestVersion(version))
      .catch(() => setLatestVersion(''));
  }, []);

  const showMessage = (text: string, bad: boolean) => {
    setMessage(text);
    setMessageBad(bad);
  };

  const loadNextPage = async () => {
    if (loadingRef.current || finishedRef.current) {
      return;
    }
    loadingRef.current = true;
    showMessage('載入中…', false);
    const requestKind = kindRef.current;
    const res = await fetchXPage(requestKind, cursorRef.current);
    loadingRef.current = false;

    // 載入途中切了分頁，這頁不要，改抓新分頁
    if (requestKind !== kindRef.current) {
      loadNextPage();
      return;
    }
    if (!res) {
      showMessage(MESSAGES.extension_error, true);
      return;
    }
    if (!res.ok) {
      showMessage(MESSAGES[res.status] || '載入失敗（' + res.status + '）', true);
      if (res.status === 'x_not_logged_in') {
        setXState('loggedOut');
      }
      return;
    }
    if (res.kind !== requestKind) {
      showMessage('擴充套件版本太舊，請更新擴充套件後重新整理', true);
      return;
    }

    setItems((prev) => prev.concat(res.items));
    countRef.current = countRef.current + res.items.length;

    if (res.items.length === 0 || !res.nextCursor || res.nextCursor === cursorRef.current) {
      finishedRef.current = true;
      if (countRef.current > 0) {
        showMessage('已經到底了，共 ' + countRef.current + ' 則', false);
      } else {
        showMessage('這裡還沒有內容', false);
      }
      return;
    }
    cursorRef.current = res.nextCursor;
    showMessage('', false);

    // 一頁填不滿畫面就繼續抓
    if (sentinelRef.current && sentinelRef.current.getBoundingClientRect().top < window.innerHeight + 600) {
      loadNextPage();
    }
  };

  // observer 只建一次，透過 ref 呼叫最新的 loadNextPage
  const loadRef = useRef(loadNextPage);
  loadRef.current = loadNextPage;

  useEffect(() => {
    if (xState !== 'loggedIn' || !sentinelRef.current) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadRef.current();
      }
    }, { rootMargin: '600px' });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [xState]);

  const onSave = async (item: XItem) => {
    if (savedIds.has(item.itemId) || savingIds.has(item.itemId)) {
      return;
    }
    setSavingIds((prev) => new Set(prev).add(item.itemId));
    try {
      await saveBookmark(item, xUserId);
      setSavedIds((prev) => new Set(prev).add(item.itemId));
    } catch (e) {
      $message('收藏失敗，稍後再試', 'error');
    }
    setSavingIds((prev) => {
      const next = new Set(prev);
      next.delete(item.itemId);
      return next;
    });
  };

  const switchKind = (newKind: XKind) => {
    if (newKind === kindRef.current) {
      return;
    }
    kindRef.current = newKind;
    setKind(newKind);
    cursorRef.current = null;
    finishedRef.current = false;
    countRef.current = 0;
    setItems([]);
    showMessage('', false);
    loadNextPage();
  };

  const openXLogin = () => {
    window.open('https://x.com/login', '_blank', 'noopener');
  };

  const onDownload = async () => {
    setDownloading(true);
    try {
      await downloadExtension(latestVersion);
    } catch (e) {
      $message('擴充套件下載失敗，稍後再試', 'error');
    }
    setDownloading(false);
  };

  let outdated = false;
  if (extState === 'ready' && latestVersion && isOlderVersion(extVersion, latestVersion)) {
    outdated = true;
  }

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
  if (outdated) {
    extDot = 'warn';
    extText = '擴充套件 v' + extVersion + '（版本過低，建議更新）';
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
          {(extState === 'missing' || outdated) && (
            <button className="btn btn-sm btn-primary" onClick={onDownload} disabled={downloading}>
              <Icon.download size={13} /> {downloading ? '下載中…' : '下載擴充套件'}
            </button>
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

      <div className="card bm-card" style={{ padding: 24 }}>
        <div className="v-row v-gap-2" style={{ marginBottom: 18 }}>
          {TABS.map((t) => (
            <button
              key={t.kind}
              className={`btn btn-sm ${t.kind === kind ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => switchKind(t.kind)}
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
              <li>按右上角「下載擴充套件」，把 zip 解壓縮</li>
              <li>開啟 <code>chrome://extensions</code>，打開右上角「開發人員模式」</li>
              <li>按「載入未封裝項目」，選解壓縮後的 <code>bookmark-sync</code> 資料夾</li>
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
          <div className="bm-list">
            {items.map((item) => (
              <PostCard
                key={item.itemId}
                item={item}
                saved={savedIds.has(item.itemId)}
                saving={savingIds.has(item.itemId)}
                onSave={onSave}
              />
            ))}
            <div ref={sentinelRef} />
            {message && (
              <div className={`bm-message ${messageBad ? 'bad' : ''}`}>
                {message}
                {messageBad && (
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: 8 }} onClick={() => loadNextPage()}>重試</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export { Bookmarks };
