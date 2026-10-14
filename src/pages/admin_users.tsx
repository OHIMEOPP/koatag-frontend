import React, { useEffect, useState } from 'react';
import { Icon } from 'components';
import { getAdminUsers, AdminUserRow } from 'services/admin.service';
import { $message } from 'utils';

// 帳號管理頁，只有 admin 進得來
type Status = '' | 'active' | 'disabled' | 'locked';

const TABS: Array<{ status: Status; label: string }> = [
  { status: '', label: '全部' },
  { status: 'active', label: '啟用中' },
  { status: 'disabled', label: '已停用' },
  { status: 'locked', label: '鎖定中' },
];

// 停用優先，其次看鎖定時間還沒到
const statusOf = (user: AdminUserRow): { label: string; className: string } => {
  if (user.is_active === 0) {
    return { label: '已停用', className: 'delete' };
  }
  if (user.locked_until && new Date(user.locked_until.replace(' ', 'T')) > new Date()) {
    return { label: '鎖定中', className: 'tag' };
  }
  return { label: '啟用中', className: 'create' };
};

// DB 時間只取到分鐘，沒有就顯示破折號
const formatTime = (value: string | null) => {
  if (!value) {
    return '—';
  }
  return value.slice(0, 16);
};

const AdminUsers: React.FC = () => {
  const [status, setStatus] = useState<Status>('');
  const [keywordInput, setKeywordInput] = useState('');
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await getAdminUsers(status, keyword, page);
        setUsers(res.data);
        setTotal(res.meta.total);
        setLastPage(res.meta.last_page);
      } catch (e) {
        $message('讀取帳號列表失敗', 'error');
      }
      setLoading(false);
    };
    load();
  }, [status, keyword, page]);

  // 換篩選或搜尋都回第一頁
  const switchStatus = (next: Status) => {
    setStatus(next);
    setPage(1);
  };

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setKeyword(keywordInput.trim());
    setPage(1);
  };

  let emptyText = '沒有帳號';
  if (loading) {
    emptyText = '載入中…';
  }

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
                onClick={() => switchStatus(t.status)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <form className="adm-search" onSubmit={onSearch}>
            <Icon.search size={14} />
            <input
              className="input"
              placeholder="搜尋帳號、名稱、email，按 Enter"
              value={keywordInput}
              onChange={(e) => setKeywordInput(e.target.value)}
            />
          </form>
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
            {users.length === 0 && (
              <tr>
                <td colSpan={7} className="adm-empty">{emptyText}</td>
              </tr>
            )}
            {users.map((user) => {
              const st = statusOf(user);
              return (
                <tr key={user.id}>
                  <td>
                    {user.account}
                    {user.is_test === 1 && <span className="badge adm-badge-gap">測試</span>}
                  </td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>
                    {user.role === 'admin' && <span className="badge update">admin</span>}
                    {user.role !== 'admin' && <span className="badge">user</span>}
                  </td>
                  <td><span className={`badge ${st.className}`}>{st.label}</span></td>
                  <td>{formatTime(user.created_at)}</td>
                  <td />
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="adm-pager">
          <span>共 {total} 個帳號</span>
          <div className="v-row v-gap-2">
            <button className="btn btn-sm btn-ghost" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              <Icon.chevronLeft size={13} /> 上一頁
            </button>
            <span>{page} / {lastPage}</span>
            <button className="btn btn-sm btn-ghost" disabled={page >= lastPage || loading} onClick={() => setPage(page + 1)}>
              下一頁 <Icon.chevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export { AdminUsers };
