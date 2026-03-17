import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck } from 'lucide-react';
import api from '../utils/api';

export default function Setup() {
  const { completeSetup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm) return setError('كلمة المرور غير متطابقة');
    if (form.password.length < 6) return setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');

    setLoading(true);
    try {
      await api.post('/setup/create-admin', {
        username: form.username,
        full_name: form.full_name,
        password: form.password,
      });
      completeSetup();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#c9a84c] font-[JetBrains_Mono]">WK-Hub</h1>
          <p className="text-gray-400 mt-2">إعداد النظام لأول مرة</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-2xl p-8 space-y-6 border border-white/10">
          <div className="flex items-center justify-center gap-2 text-[#c9a84c]">
            <ShieldCheck size={24} />
            <h2 className="text-xl font-semibold">إنشاء حساب مدير النظام</h2>
          </div>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-2">الاسم الكامل</label>
            <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c]"
              placeholder="أحمد محمد" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم المستخدم</label>
            <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c]"
              placeholder="admin" dir="ltr" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">كلمة المرور</label>
            <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c]"
              placeholder="••••••••" dir="ltr" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">تأكيد كلمة المرور</label>
            <input type="password" value={form.confirm} onChange={e => setForm({ ...form, confirm: e.target.value })} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c]"
              placeholder="••••••••" dir="ltr" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-[#c9a84c] text-[#1a1a2e] font-semibold rounded-xl hover:bg-[#d4b85c] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            <ShieldCheck size={18} />
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب'}
          </button>
        </form>
      </div>
    </div>
  );
}
