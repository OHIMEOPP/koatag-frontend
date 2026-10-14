import React, { useEffect, useState } from 'react';
import { Icon } from 'components';
import { ConfirmDialog } from 'components/drive';
import { getAdminUsers, disableUser, enableUser, unlockUser, AdminUserRow } from 'services/admin.service';
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

type Action = 'disable' | 'enable' | 'unlock';

// 確認視窗的標題、按鈕與說明
const ACTION_TEXT: Record<Action, { label: string; title: string; message: string }> = {
  disable: {
    label: '停用',
    title: '停用帳號',
    message: '停用後對方會立刻被登出，也無法再登入，之後可以重新啟用。',
  },
  enable: {
    label: '重新啟用',
    title: '重新啟用帳號',
    message: '重新啟用後對方可以再次登入。',
  },
  unlock: {
    label: '解鎖',
    title: '解除登入鎖定',
    message: '解鎖後登入失敗次數歸零，對方可以馬上重新登入。',
  },
};

// 鎖定中或有登入失敗次數才需要解鎖
const canUnlock = (user: AdminUserRow) => {
  if (user.login_fail_count > 0) {
    return true;
  }
  if (user.locked_until && new Date(user.locked_until.replace(' ', 'T')) > new Date()) {
    return true;
  }
  return false;
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
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState<{ action: Action; user: AdminUserRow } | null>(null);
  const myId = Number(localStorage.getItem('user_id') || '0');

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

  // 用 API 回傳的那筆換掉列表裡同 id 的那列
  const replaceUser = (updated: AdminUserRow) => {
    setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
  };

  const setBusy = (id: number, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  // 三種操作都在確認視窗裡執行，失敗丟錯讓視窗顯示
  const onConfirm = async () => {
    if (!pending) {
      return;
    }
    const id = pending.user.id;
    const label = ACTION_TEXT[pending.action].label;
    setBusy(id, true);
    try {
      let updated: AdminUserRow;
      if (pending.action === 'disable') {
        updated = await disableUser(id);
      } else if (pending.action === 'enable') {
        updated = await enableUser(id);
      } else {
        updated = await unlockUser(id);
      }
      replaceUser(updated);
      $message('已' + label + ' ' + updated.account);
    } catch (e: any) {
      setBusy(id, false);
      if (e?.response?.data?.error?.code === 'CANNOT_DISABLE_SELF') {
        throw new Error('不能停用自己');
      }
      throw new Error(label + '失敗，稍後再試');
    }
    setBusy(id, false);
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
              const busy = busyIds.has(user.id);
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
                  <td>
                    <div className="adm-actions">
                      {canUnlock(user) && (
                        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setPending({ action: 'unlock', user: user })}>
                          解鎖
                        </button>
                      )}
                      {user.is_active === 0 && (
                        <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => setPending({ action: 'enable', user: user })}>
                          重新啟用
                        </button>
                      )}
                      {user.is_active === 1 && user.id !== myId && (
                        <button className="btn btn-sm btn-ghost adm-danger" disabled={busy} onClick={() => setPending({ action: 'disable', user: user })}>
                          停用
                        </button>
                      )}
                    </div>
                  </td>
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

      {pending && (
        <ConfirmDialog
          title={ACTION_TEXT[pending.action].title}
          message={`確定${ACTION_TEXT[pending.action].label}「${pending.user.account}」？${ACTION_TEXT[pending.action].message}`}
          confirmLabel={ACTION_TEXT[pending.action].label}
          destructive={pending.action === 'disable'}
          onConfirm={onConfirm}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
};

export { AdminUsers };
