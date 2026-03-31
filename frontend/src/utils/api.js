import axios from 'axios';

// Phase 1.2: withCredentials sends httpOnly cookies automatically — no more localStorage token
const api = axios.create({ baseURL: '/api', timeout: 30000, withCredentials: true });

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !window.location.hash?.includes('login') && !window.location.pathname?.endsWith('/login')) {
      localStorage.removeItem('wk_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
