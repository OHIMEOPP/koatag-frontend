import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icon } from './Icon';
import { logout } from 'services/auth.service';

interface SidebarProps {
  collapsed: boolean;
}

type IconName = keyof typeof Icon;

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  badge?: string;
  // placeholder = nav item exists in design but underlying feature/page isn't built;
  // routes to front_page or no-op so it doesn't 404, never renders as active.
  placeholder?: boolean;
}

const NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: '媒體',
    items: [
      { to: '/main/front_page',  label: '首頁',     icon: 'home' },
      { to: '/main/image_area',  label: '圖庫',     icon: 'gallery', badge: '1,716' },
      { to: '/main/upload_area', label: '上傳',     icon: 'upload' },
      { to: '/main/drive',       label: 'Drive',    icon: 'cloud' },
      { to: '/main/front_page',  label: '我的最愛', icon: 'heart',   badge: '184', placeholder: true },
    ],
  },
  {
    section: '管理',
    items: [
      { to: '/main/front_page', label: '標籤',     icon: 'tag',     placeholder: true },
      { to: '/main/history',    label: '瀏覽紀錄', icon: 'history' },
      { to: '/main/front_page', label: '隱私',     icon: 'shield',  placeholder: true },
    ],
  },
  {
    section: '帳號',
    items: [
      { to: '/main/front_page', label: '個人資料', icon: 'user',     placeholder: true },
      { to: '/main/front_page', label: '設定',     icon: 'settings', placeholder: true },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ collapsed }) => {
  const location = useLocation();
  const userRaw = localStorage.getItem('user');
  const user = userRaw ? JSON.parse(userRaw) : null;
  const account: string = user?.account ?? 'guest';
  const initial = account.slice(0, 2).toUpperCase();

  const handleLogout = async (e: React.MouseEvent) => {
    e.preventDefault();
    await logout();
  };

  return (
    <aside className="side">
      <div className="side-brand">
        <div className="brand-mark">K</div>
        <div>
          <div className="brand-text">KOATAG</div>
          <div className="brand-text-2">v3 · CINEMATIC</div>
        </div>
      </div>
      <nav className="side-nav">
        {NAV.map((sec) => (
          <div key={sec.section}>
            <div className="side-section">{sec.section}</div>
            {sec.items.map((item) => {
              const I = Icon[item.icon];
              const active = !item.placeholder && location.pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={`nav-item ${active ? 'active' : ''}`}
                >
                  <I className="nav-icon" />
                  <span className="nav-label">{item.label}</span>
                  {item.badge && <span className="nav-badge">{item.badge}</span>}
                </Link>
              );
            })}
            {sec.section === '帳號' && (
              <a href="#" onClick={handleLogout} className="nav-item">
                <Icon.logout className="nav-icon" />
                <span className="nav-label">登出</span>
              </a>
            )}
          </div>
        ))}
      </nav>
      <div className="side-foot">
        <div className="user-card">
          <div className="user-avatar">{initial}</div>
          <div className="side-foot-text">
            <div className="user-name">{account}</div>
            <div className="user-meta">Pro · 1,716 張</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
