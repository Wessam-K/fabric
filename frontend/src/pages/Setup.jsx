import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Eye, EyeOff, Check, X } from 'lucide-react';
import api from '../utils/api';

export default function Setup() {
  const { completeSetup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: '', username: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const pw = form.password;
  const rules = [
    { ok: pw.length >= 8, label: '٨ أحرف على الأقل' },
    { ok: /[A-Z]/.test(pw), label: 'حرف كبير (A-Z)' },
    { ok: /\d/.test(pw), label: 'رقم واحد على الأقل' },
  ];
  const allValid = rules.every(r => r.ok);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!allValid) return setError('كلمة المرور لا تستوفي الشروط المطلوبة');
    if (form.password !== form.confirm) return setError('كلمة المرور غير متطابقة');

    setLoading(true);
    try {
      await api.post('/setup/create-admin', {
        username: form.username.trim(),
        full_name: form.full_name.trim(),
        password: form.password,
      });
      completeSetup();
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ في إنشاء الحساب');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#c9a84c]/20 flex items-center justify-center">
            <ShieldCheck size={32} className="text-[#c9a84c]" />
          </div>
          <h1 className="text-3xl font-bold text-[#c9a84c]">WK-Factory</h1>
          <p className="text-gray-400 mt-2">إعداد النظام لأول مرة</p>
          <p className="text-gray-500 text-xs mt-1">قم بإنشاء حساب مدير النظام للبدء</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-2xl p-8 space-y-5 border border-white/10">
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-2">الاسم الكامل</label>
            <input type="text" value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} required
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors"
              placeholder="أحمد محمد" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم المستخدم</label>
            <input type="text" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} required
              autoComplete="username"
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors"
              placeholder="admin" dir="ltr" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">كلمة المرور</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={form.password}
                onChange={e => setForm({ ...form, password: e.target.value })} required
                autoComplete="new-password"
                className="w-full px-4 py-3 pl-12 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors"
                placeholder="••••••••" dir="ltr" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {pw.length > 0 && (
              <div className="mt-2 space-y-1">
                {rules.map((r, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs ${r.ok ? 'text-green-400' : 'text-gray-500'}`}>
                    {r.ok ? <Check size={12} /> : <X size={12} />}
                    <span>{r.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">تأكيد كلمة المرور</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={form.confirm}
                onChange={e => setForm({ ...form, confirm: e.target.value })} required
                autoComplete="new-password"
                className={`w-full px-4 py-3 pl-12 bg-white/10 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                  form.confirm && form.confirm !== form.password ? 'border-red-500/50' : 'border-white/20 focus:border-[#c9a84c]'
                }`}
                placeholder="••••••••" dir="ltr" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 transition-colors">
                {showConfirm ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            {form.confirm && form.confirm !== form.password && (
              <p className="text-xs text-red-400 mt-1">كلمة المرور غير متطابقة</p>
            )}
          </div>

          <button type="submit" disabled={loading || !allValid || !form.confirm || form.password !== form.confirm}
            className="w-full py-3 bg-[#c9a84c] text-[#1a1a2e] font-semibold rounded-xl hover:bg-[#d4b85c] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <ShieldCheck size={18} />
            {loading ? 'جاري الإنشاء...' : 'إنشاء الحساب والبدء'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">WK-Factory v3.0.0 — نظام إدارة المصنع</p>
      </div>
    </div>
  );
}
