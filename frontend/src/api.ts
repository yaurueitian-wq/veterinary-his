import axios from "axios";

/**
 * 全域 API client
 * 基礎 URL 由環境變數 VITE_API_BASE_URL 設定（預設 http://localhost:8000）
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: {
    "Content-Type": "application/json",
  },
});

// 自動附加 JWT token（登入後設置）
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
