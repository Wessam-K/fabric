import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

const ROLE_LABELS = {
  superadmin: 'مدير النظام',
  manager: 'مدير',
  accountant: 'محاسب',
  production: 'إنتاج',
  hr: 'موارد بشرية',
  viewer: 'مشاهد',
};

const ROLE_COLORS = {
  superadmin: 'bg-[#c9a84c] text-black',
  manager: 'bg-blue-500 text-white',
  accountant: 'bg-green-500 text-white',
  production: 'bg-purple-500 text-white',
  hr: 'bg-orange-500 text-white',
  viewer: 'bg-gray-500 text-white',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [permissions, setPermissions] = useState({});

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    try {
      // Check if setup needed
      const setupRes = await api.get('/setup/status');
      if (setupRes.data.needs_setup) {
        setNeedsSetup(true);
        setLoading(false);
        return;
      }

      const token = localStorage.getItem('wk_token');
      if (!token) { setLoading(false); return; }

      const res = await api.get('/auth/me');
      setUser(res.data);
      localStorage.setItem('wk_user', JSON.stringify(res.data));

      // Load user permissions
      try {
        const permRes = await api.get('/permissions/my');
        setPermissions(permRes.data);
      } catch { /* permissions will be empty, role-based fallback */ }
    } catch {
      localStorage.removeItem('wk_token');
      localStorage.removeItem('wk_user');
    } finally {
      setLoading(false);
    }
  }

  async function login(username, password) {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('wk_token', res.data.token);
    localStorage.setItem('wk_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    // Load permissions after login
    try {
      const permRes = await api.get('/permissions/my');
      setPermissions(permRes.data);
    } catch {}
    return res.data;
  }

  async function logout() {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('wk_token');
    localStorage.removeItem('wk_user');
    setUser(null);
    setPermissions({});
  }

  function hasRole(...roles) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    return roles.includes(user.role);
  }

  function can(module, action) {
    if (!user) return false;
    if (user.role === 'superadmin') return true;
    const key = `${module}:${action}`;
    return !!permissions[key];
  }

  function completeSetup() {
    setNeedsSetup(false);
  }

  return (
    <AuthContext.Provider value={{ user, loading, needsSetup, permissions, login, logout, hasRole, can, completeSetup, ROLE_LABELS, ROLE_COLORS }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
