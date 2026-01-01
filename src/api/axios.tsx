import axios from "axios"; 
import { logout } from "services/auth.service";
import { $message } from "utils";

const api = axios.create({
  // 不設定 baseURL，改由 interceptor 根據方法動態決定
});

api.interceptors.request.use(
  (config) => {
    // 設定動態 baseURL
    if (config.method?.toLowerCase() === 'get') {
      config.baseURL = process.env.REACT_APP_NODERED_API_URL;
    } else if (config.method?.toLowerCase() === 'post') {
      config.baseURL = process.env.API_URL || process.env.REACT_APP_API_URL;
    }

    // 帶 token
    const token = localStorage.getItem("token");
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response && error.response.status === 401) {
      $message("登入超時，請重新登入");
      await logout();
    }
    return Promise.reject(error);
  }
);

export default api;
