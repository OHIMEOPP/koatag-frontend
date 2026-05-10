import api from "api/axios";
import axios from "axios";
import { $message, delay } from "utils";

// Backend POST /login response shape (per koatag 2026-05-02 contract):
// success → HTTP 200 + { status: 'success', massage, 'user_id(nosession)', token, expires_in }
// fail (帳號/密碼錯誤) → HTTP 200 + { status: 'login-fail', massage }
// JWT 簽發異常 → HTTP 500 + { error } (no status field)
// `massage` is a backend typo (not message) — preserved per contract.
// `user_id(nosession)` literal key (parens included) — alias to userId internally.
interface LoginSuccess {
    status: 'success';
    massage: string;
    'user_id(nosession)': number;
    token: string;
    expires_in: number;
}
interface LoginFail {
    status: 'login-fail';
    massage: string;
}
type LoginResponse = LoginSuccess | LoginFail;

interface LogoutResponse {
    message: string;
}

export class LoginError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LoginError';
    }
}

export const getUser = async () => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            alert('未登入，請先登入以取得 token');
            return;
        }
        const response = await api.get(`/getUser`);

        let userData: any = response.data;
        if (userData?.result) {
            userData = userData.result;
        } else if (userData?.data) {
            userData = userData.data;
        }

        localStorage.setItem('user', JSON.stringify(userData));

        if (userData?.id) {
            localStorage.setItem('user_id', String(userData.id));
        } else if (userData?.user_id) {
            localStorage.setItem('user_id', String(userData.user_id));
        }
    } catch (e) {
        console.error(e);
        alert(`取得使用者資料失敗 -> ${e}`);
    }
};

export const login = async (account: string, password: string): Promise<void> => {
    const response = await api.post<LoginResponse>(`/login`, { account, password });
    const data = response.data;

    if (data.status !== 'success') {
        throw new LoginError(data.massage || '登入失敗');
    }

    localStorage.setItem('token', data.token);
    localStorage.setItem('user_id', String(data['user_id(nosession)']));
    localStorage.setItem('tokenExpireAt', String(Date.now() + data.expires_in * 1000));

    await getUser();
    window.location.href = '/main';
};

export const logout = async () => {
    try {
        await axios.post<LogoutResponse>(`${process.env.REACT_APP_API_URL}/logout`);
        $message("即將登出請稍後...");
        await delay(2);
    } catch (e) {
        alert(`登出失敗 -> ${e}`);
    } finally {
        localStorage.clear();
        window.location.href = '/login';
    }
};
