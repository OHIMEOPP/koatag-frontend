import axios from "axios"; 
import { logout } from "services/auth.service";
import { $message } from "utils";

const api = axios.create({
  // 不設定 baseURL，改由 interceptor 根據方法動態決定
});

api.interceptors.request.use(
  (config) => {
    // 沒指定 baseURL 時一律打 Laravel
    if (!config.baseURL) {
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
