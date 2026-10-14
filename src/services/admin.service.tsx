import api from "api/axios";

export type AdminUserRow = {
  id: number;
  account: string;
  name: string;
  email: string;
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
