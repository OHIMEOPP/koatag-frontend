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
    section: 'Library',
    items: [
      { to: '/main/front_page',  label: 'Front page', icon: 'home' },
      { to: '/main/image_area',  label: 'Gallery',    icon: 'gallery', badge: '1,716' },
      { to: '/main/upload_area', label: 'Upload',     icon: 'upload' },
      { to: '/main/front_page',  label: 'Favorites',  icon: 'heart',   badge: '184', placeholder: true },
    ],
  },
  {
    section: 'Manage',
    items: [
      { to: '/main/front_page', label: 'Tags',    icon: 'tag',     placeholder: true },
      { to: '/main/history',    label: 'History', icon: 'history' },
      { to: '/main/front_page', label: 'Privacy', icon: 'shield',  placeholder: true },
    ],
  },
  {
    section: 'Account',
    items: [
      { to: '/main/front_page', label: 'Profile',  icon: 'user',     placeholder: true },
      { to: '/main/front_page', label: 'Settings', icon: 'settings', placeholder: true },
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
            {sec.section === 'Account' && (
              <a href="#" onClick={handleLogout} className="nav-item">
                <Icon.logout className="nav-icon" />
                <span className="nav-label">Sign out</span>
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
            <div className="user-meta">Pro · 1,716 imgs</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
