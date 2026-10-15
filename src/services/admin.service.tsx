import api from "api/axios";

export type AdminUserRow = {
  id: number;
  account: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  role: 'user' | 'admin';
  is_active: number;
  is_test: number;
  login_fail_count: number;
  locked_until: string | null;
  disabled_at: string | null;
  disabled_by: number | null;
  created_at: string | null;
  updated_at: string | null;
};
type AdminUsersResponse = {
  ok: boolean;
  data: AdminUserRow[];
  meta: { page: number; per_page: number; total: number; last_page: number };
};

// 帳號列表，status 空字串代表全部
export const getAdminUsers = async (status: string, keyword: string, page: number) => {
    const params: Record<string, string | number> = { page: page, per_page: 20 };
    if (status !== '') {
        params.status = status;
    }
    if (keyword !== '') {
        params.keyword = keyword;
    }
    const response = await api.get<AdminUsersResponse>(`/admin/users`, { params: params });
    return response.data;
}

type AdminUserResponse = { ok: boolean; data: AdminUserRow };

// 停用帳號，回傳更新後的那筆
export const disableUser = async (id: number) => {
    const response = await api.post<AdminUserResponse>(`/admin/users/${id}/disable`);
    return response.data.data;
}

// 重新啟用帳號，回傳更新後的那筆
export const enableUser = async (id: number) => {
    const response = await api.post<AdminUserResponse>(`/admin/users/${id}/enable`);
    return response.data.data;
}

// 解除登入鎖定，回傳更新後的那筆
export const unlockUser = async (id: number) => {
    const response = await api.post<AdminUserResponse>(`/admin/users/${id}/unlock`);
    return response.data.data;
}
