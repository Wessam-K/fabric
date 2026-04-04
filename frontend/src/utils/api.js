import axios from 'axios';

// Phase 1.2: withCredentials sends httpOnly cookies automatically — no more localStorage token
const api = axios.create({ baseURL: '/api', timeout: 30000, withCredentials: true });

// Phase 1.1: CSRF double-submit — read wk_csrf cookie and attach as header on state-changing requests
api.interceptors.request.use(config => {
  if (config.method && !['get', 'head', 'options'].includes(config.method)) {
    const match = document.cookie.match(/(?:^|;\s*)wk_csrf=([^;]+)/);
    if (match) config.headers['X-CSRF-Token'] = match[1];
  }
  return config;
});

let isRedirecting = false;

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !isRedirecting && !window.location.hash?.includes('login') && !window.location.pathname?.endsWith('/login')) {
      isRedirecting = true;
      localStorage.removeItem('wk_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
