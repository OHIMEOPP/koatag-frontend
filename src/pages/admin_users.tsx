import React, { useState } from 'react';
import { Icon } from 'components';

// 帳號管理頁，只有 admin 進得來
type Status = 'all' | 'active' | 'disabled' | 'locked';

const TABS: Array<{ status: Status; label: string }> = [
  { status: 'all', label: '全部' },
  { status: 'active', label: '啟用中' },
  { status: 'disabled', label: '已停用' },
  { status: 'locked', label: '鎖定中' },
];

const AdminUsers: React.FC = () => {
  const [status, setStatus] = useState<Status>('all');
  const [keyword, setKeyword] = useState('');

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="t-h1 page-title">帳號管理</h1>
          <p className="page-sub">查看帳號狀態，停用、重新啟用或解除登入鎖定</p>
        </div>
      </div>

      <div className="card" style={{ padding: 24 }}>
        <div className="adm-toolbar">
          <div className="v-row v-gap-2">
            {TABS.map((t) => (
              <button
                key={t.status}
                className={`btn btn-sm ${t.status === status ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setStatus(t.status)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="adm-search">
            <Icon.search size={14} />
            <input
              className="input"
              placeholder="搜尋帳號、名稱、email"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>

        <table className="adm-table">
          <thead>
            <tr>
              <th>帳號</th>
              <th>名稱</th>
              <th>Email</th>
              <th>角色</th>
              <th>狀態</th>
              <th>建立時間</th>
              <th aria-label="actions" />
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7} className="adm-empty">沒有帳號</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { AdminUsers };
