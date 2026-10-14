import React from 'react';
import { Link } from 'react-router-dom';

// 網址不存在或沒有權限都顯示這頁
const NotFound: React.FC = () => {
  return (
    <div className="page">
      <div className="card adm-not-found">
        <h1 className="t-h1">找不到頁面</h1>
        <p className="page-sub">這個網址不存在</p>
        <Link to="/main/front_page" className="btn btn-sm btn-primary">回首頁</Link>
      </div>
    </div>
  );
};

export { NotFound };
