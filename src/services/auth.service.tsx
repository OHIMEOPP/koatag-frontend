// import exp from "constants";

import api from "api/axios";
import { $message, delay } from "utils";

interface AuthResponse {
    url: string;
    path: string;
    message: string;
    token: string
    data: {
        user_id: number;
        // 其他欄位...
    };
}

const apiURL = process.env.REACT_APP_API_URL;

export const getUser = async () => {
    try {
        const token = localStorage.getItem('token'); // 從 localStorage 拿 token
        if (!token) {
            alert('未登入，請先登入以取得 token');
            return;
        }
        console.log(token)
        const response = await api.get(`/getUser`);

        console.log(response.data);
        localStorage.setItem('user', JSON.stringify(response.data))
    } catch (e) {
        console.error(e);
        alert(`取得使用者資料失敗 -> ${e}`);
    }
};

export const login = async (account: string, password: string) => {

    try {
        const response = await axios.post<AuthResponse>(`${apiURL}/login`, {
            account: account,
            password: password,
        });

        const token = response.data.token;
        localStorage.setItem('token', token); // 儲存 JWT token
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`; // 設定預設 token
        await getUser();
        window.location.href = '/main'
        // alert(`登入成功，token: ${token}`);

    } catch (e) {
        alert(`登入失敗 -> ${e}`);
    }
};

export const logout = async () => {
    try {
        const response = await axios.post<AuthResponse>(`${apiURL}/logout`);

        const message = response.data.message;

        $message("即將登出請稍後...");
        await delay(2);
    } catch (e) {
        alert(`登出失敗 -> ${e}`);
    } finally {
        localStorage.clear(); // 無論成功或失敗都清除 token
        window.location.href = '/login';
    }
};