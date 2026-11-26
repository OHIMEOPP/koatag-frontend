import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { TagSearchBox } from './TagSearchBox';
import { logout } from 'services/auth.service';

interface TopbarProps {
  onCollapse: () => void;
}

const PATH_LABELS: Record<string, string> = {
  '/main/front_page':  '首頁',
  '/main/upload_area': '上傳',
  '/main/image_area':  '圖庫',
  '/main/image_page':  '圖片詳情',
  '/main/history':     '瀏覽紀錄',
  '/main/feedback':    '回報',
};

export const Topbar: React.FC<TopbarProps> = ({ onCollapse }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const label = PATH_LABELS[location.pathname] ?? '媒體';

  // 送出後到圖庫頁用標籤篩選
  const handleSearch = (query: string) => {
    navigate(`/main/image_area?tag=${encodeURIComponent(query)}`);
  };

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="top">
      <button className="icon-btn" onClick={onCollapse} aria-label="toggle sidebar">
        <Icon.menu />
      </button>
      <div className="crumbs">
        <span>KOATAG</span>
        <span className="sep">/</span>
        <span className="here">{label}</span>
      </div>
      <div className="spacer" />
      <TagSearchBox onSearch={handleSearch} showKbd />
      <button className="icon-btn" aria-label="notifications">
        <Icon.bell />
        <span className="dot"></span>
      </button>
      <button className="icon-btn" onClick={handleLogout} aria-label="logout">
        <Icon.logout />
      </button>
    </header>
  );
};
