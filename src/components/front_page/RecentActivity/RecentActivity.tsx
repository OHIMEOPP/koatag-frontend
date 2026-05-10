import React from 'react';

// Recent activity preview — 4 筆 mock，原始 design 有此區塊但整合版砍掉。
// 後端零 operation_logs endpoint (Step 10 才會跟 koatag 對齊真實資料)，先 mock。
type BadgeKind = 'create' | 'update' | 'delete' | 'tag';
interface RecentEvent {
    time: string;
    badge: [BadgeKind, string];
    text: string;
    target: string;
}

const RECENT: RecentEvent[] = [
    { time: '今天 · 14:32', badge: ['update', '已更新標籤'], text: '為 ', target: 'hatsune_miku_winter.jpg' },
    { time: '今天 · 11:08', badge: ['create', '已上傳'],     text: '上傳 12 張圖到圖庫', target: '' },
    { time: '今天 · 09:14', badge: ['tag',    '新建標籤'],   text: '建立角色標籤 ', target: 'Frieren' },
    { time: '昨天 · 22:41', badge: ['update', '已編輯'],     text: '變更可見度 ', target: 'momoco_archive_07.jpg' },
];

const RecentActivity: React.FC = () => (
    <div className="card" style={{ padding: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>最近活動</h3>
            <a href="/main/history" style={{ fontSize: 11, color: 'var(--color-text-quaternary)', textDecoration: 'none' }}>
                查看全部 →
            </a>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {RECENT.map((ev, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 4px' }}>
                    <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--color-text-quaternary)', fontSize: 11, minWidth: 92 }}>
                        {ev.time}
                    </span>
                    <span className={`badge ${ev.badge[0]}`}>{ev.badge[1]}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)', flex: 1 }}>
                        {ev.text}
                        {ev.target && <b style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{ev.target}</b>}
                    </span>
                </div>
            ))}
        </div>
    </div>
);

export { RecentActivity };
