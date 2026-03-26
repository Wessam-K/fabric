import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

let isRefreshing = false;
let refreshPromise = null;

function parseJwtExp(token) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(base64));
    return payload.exp || 0;
  } catch { return 0; }
}

async function refreshTokenIfNeeded() {
  const token = localStorage.getItem('wk_token');
  if (!token) return;
  const exp = parseJwtExp(token);
  const now = Math.floor(Date.now() / 1000);
  // Refresh if less than 2 hours remaining
  if (exp - now > 7200) return;
  if (isRefreshing) return refreshPromise;
  isRefreshing = true;
  refreshPromise = axios.post('/api/auth/refresh', null, {
    headers: { Authorization: `Bearer ${token}` }
  }).then(res => {
    localStorage.setItem('wk_token', res.data.token);
  }).catch(() => {
    // refresh failed — let the 401 interceptor handle it
  }).finally(() => {
    isRefreshing = false;
    refreshPromise = null;
  });
  return refreshPromise;
}

api.interceptors.request.use(async config => {
  await refreshTokenIfNeeded();
  const token = localStorage.getItem('wk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && !window.location.hash?.includes('login') && !window.location.pathname?.endsWith('/login')) {
      localStorage.removeItem('wk_token');
      localStorage.removeItem('wk_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
