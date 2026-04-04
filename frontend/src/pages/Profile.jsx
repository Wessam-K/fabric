import { useState, useEffect, useRef } from 'react';
import { User, Mail, Building, Clock, Shield, Key, CalendarDays, Monitor, Trash2, LogOut, Camera, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { PageHeader, LoadingState } from '../components/ui';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';

const ACTION_LABELS = {
  LOGIN: 'تسجيل دخول',
  LOGOUT: 'تسجيل خروج',
  CREATE: 'إنشاء',
  UPDATE: 'تعديل',
  DELETE: 'حذف',
};

export default function Profile() {
  const { ROLE_LABELS, ROLE_COLORS } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const avatarRef = useRef(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [prefs, setPrefs] = useState({ language: 'ar', notifications_enabled: 'true', items_per_page: '25' });

  useEffect(() => {
    api.get('/auth/profile').then(r => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false));
    api.get('/sessions').then(r => setSessions(r.data)).catch(() => {}).finally(() => setSessionsLoading(false));
    // Load preferences
    Promise.all(['language', 'notifications_enabled', 'items_per_page'].map(k =>
      api.get(`/users/preferences/${k}`).then(r => [k, r.data.value]).catch(() => [k, null])
    )).then(results => {
      const loaded = {};
      results.forEach(([k, v]) => { if (v != null) loaded[k] = v; });
      setPrefs(p => ({ ...p, ...loaded }));
    });
  }, []);

  const revokeSession = (id) => {
    api.delete(`/sessions/${id}`).then(() => setSessions(prev => prev.filter(s => s.id !== id))).catch(() => {});
  };

  const revokeAllSessions = () => {
    api.delete('/sessions').then(() => setSessions([])).catch(() => {});
  };

  const savePref = async (key, value) => {
    setPrefs(p => ({ ...p, [key]: value }));
    try { await api.put(`/users/preferences/${key}`, { value }); } catch { toast.error('فشل حفظ التفضيل'); }
  };

  if (loading) return <LoadingState />;
  if (!profile) return <div className="text-center py-20 text-gray-400">خطأ في تحميل الملف الشخصي</div>;

  return (
    <div className="page max-w-3xl mx-auto">
      <PageHeader title="الملف الشخصي" subtitle="معلوماتك وآخر نشاطاتك"
        actions={<div className="flex items-center gap-2"><HelpButton pageKey="profile" /><button onClick={() => navigate('/change-password')} className="btn btn-gold"><Key size={14} /> تغيير كلمة المرور</button></div>}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Card */}
        <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
          <div className="relative w-20 h-20 mx-auto mb-4 group cursor-pointer" onClick={() => avatarRef.current?.click()}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#1a1a2e] flex items-center justify-center">
                <span className="text-2xl font-bold text-[#c9a84c]">{profile.full_name?.charAt(0)}</span>
              </div>
            )}
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera size={20} className="text-white" />
            </div>
            <input ref={avatarRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const fd = new FormData();
              fd.append('avatar', file);
              try {
                const { data } = await api.post(`/users/${profile.id}/avatar`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                setProfile(p => ({ ...p, avatar_url: data.avatar_url }));
                toast.success('تم تحديث الصورة');
              } catch { toast.error('فشل رفع الصورة'); }
            }} />
          </div>
          <h2 className="text-lg font-bold text-[#1a1a2e]">{profile.full_name}</h2>
          <p className="text-xs text-gray-400 font-mono">@{profile.username}</p>
          <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full ${ROLE_COLORS[profile.role] || 'bg-gray-200 text-gray-600'}`}>
            {ROLE_LABELS[profile.role] || profile.role}
          </span>

          <div className="mt-6 space-y-3 text-right">
            {profile.email && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Mail size={14} className="text-gray-400" />
                <span>{profile.email}</span>
              </div>
            )}
            {profile.department && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Building size={14} className="text-gray-400" />
                <span>{profile.department}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <CalendarDays size={14} className="text-gray-400" />
              <span>انضم {profile.created_at ? new Date(profile.created_at).toLocaleDateString('ar-EG') : '—'}</span>
            </div>
            {profile.last_login && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={14} className="text-gray-400" />
                <span>آخر دخول {new Date(profile.last_login).toLocaleString('ar-EG')}</span>
              </div>
            )}
            {profile.password_changed_at && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shield size={14} className="text-gray-400" />
                <span>تغيير المرور {new Date(profile.password_changed_at).toLocaleDateString('ar-EG')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-5 border-b">
            <h3 className="text-sm font-bold text-[#1a1a2e]">آخر النشاطات</h3>
          </div>
          <div className="divide-y divide-gray-50 max-h-[500px] overflow-y-auto">
            {(profile.recent_activity || []).length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">لا توجد نشاطات</div>
            ) : (
              profile.recent_activity.map((a, i) => (
                <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    a.action === 'LOGIN' ? 'bg-green-50 text-green-600' :
                    a.action === 'LOGOUT' ? 'bg-gray-100 text-gray-500' :
                    a.action === 'CREATE' ? 'bg-blue-50 text-blue-600' :
                    a.action === 'DELETE' ? 'bg-red-50 text-red-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    <User size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#1a1a2e]">
                      <span className="font-bold">{ACTION_LABELS[a.action] || a.action}</span>
                      {a.entity_type && <span className="text-gray-400 mx-1">·</span>}
                      {a.entity_label && <span className="text-gray-500">{a.entity_label}</span>}
                    </p>
                    <p className="text-[10px] text-gray-400">{a.created_at ? new Date(a.created_at).toLocaleString('ar-EG') : ''}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1a1a2e]">الجلسات النشطة</h3>
          {sessions.length > 0 && (
            <button onClick={revokeAllSessions} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
              <LogOut size={12} /> إلغاء الكل
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
          {sessionsLoading ? (
            <div className="p-8 text-center text-gray-400 text-sm">جاري التحميل...</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">لا توجد جلسات نشطة</div>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                  <Monitor size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#1a1a2e] truncate">{s.user_agent || 'متصفح غير معروف'}</p>
                  <p className="text-[10px] text-gray-400">
                    {s.ip_address || '—'} · {s.created_at ? new Date(s.created_at).toLocaleString('ar-EG') : ''}
                  </p>
                </div>
                <button onClick={() => revokeSession(s.id)} className="text-red-400 hover:text-red-600 p-1" title="إلغاء الجلسة">
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Preferences */}
      <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b flex items-center gap-2">
          <Settings size={16} className="text-gray-400" />
          <h3 className="text-sm font-bold text-[#1a1a2e]">التفضيلات</h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">اللغة</label>
            <select value={prefs.language} onChange={e => savePref('language', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="ar">العربية</option>
              <option value="en">English</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">الإشعارات</label>
            <button onClick={() => savePref('notifications_enabled', prefs.notifications_enabled === 'true' ? 'false' : 'true')}
              className={`w-10 h-5 rounded-full transition-colors relative ${prefs.notifications_enabled === 'true' ? 'bg-green-500' : 'bg-gray-300'}`}>
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${prefs.notifications_enabled === 'true' ? 'right-0.5' : 'left-0.5'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm text-gray-700">عناصر لكل صفحة</label>
            <select value={prefs.items_per_page} onChange={e => savePref('items_per_page', e.target.value)}
              className="border rounded-lg px-3 py-1.5 text-sm">
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
