/**
 * API基础服务
 */
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  (config) => {
    // 可以在这里添加认证token等
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    if (error.response) {
      // 服务器返回了错误状态码
      return Promise.reject({
        message: error.response.data?.detail || error.message,
        status: error.response.status,
      });
    } else if (error.request) {
      // 请求已发出但没有收到响应
      return Promise.reject({
        message: '网络错误，请检查网络连接',
        status: 0,
      });
    } else {
      // 其他错误
      return Promise.reject({
        message: error.message,
        status: -1,
      });
    }
  }
);

export default api;

