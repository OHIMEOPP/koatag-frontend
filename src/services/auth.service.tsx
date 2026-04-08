import api from "api/axios";
import { $message, delay } from "utils";

interface AuthResponse {
    url: string;
    path: string;
    message: string;
    token: string
    data: {
        user_id: number;
    };
}

export const getUser = async () => {
    try {
        const token = localStorage.getItem('token'); // 從 localStorage 拿 token
        if (!token) {
            alert('未登入，請先登入以取得 token');
            return;
        }
        const response = await api.get(`/getUser`);

        localStorage.setItem('user', JSON.stringify(response.data))
    } catch (e) {
        console.error(e);
        alert(`取得使用者資料失敗 -> ${e}`);
    }
};

export const login = async (account: string, password: string) => {
    try {
        const response = await api.post<AuthResponse>(`/login`, {
            account: account,
            password: password,
        });

        const token = response.data.token;
        localStorage.setItem('token', token);
        await getUser();
        window.location.href = '/main';
    } catch (e) {
        alert(`登入失敗 -> ${e}`);
    }
};

export const logout = async () => {
    try {
        await api.post<AuthResponse>(`/logout`);

        $message("即將登出請稍後...");
        await delay(2);
    } catch (e) {
        alert(`登出失敗 -> ${e}`);
    } finally {
        localStorage.clear();
        window.location.href = '/login';
    }
};