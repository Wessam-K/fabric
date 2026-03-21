import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, Shield } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const RULES = [
  { test: (p) => p.length >= 8, label: '8 أحرف على الأقل' },
  { test: (p) => /[A-Z]/.test(p), label: 'حرف كبير واحد على الأقل' },
  { test: (p) => /[0-9]/.test(p), label: 'رقم واحد على الأقل' },
  { test: (p) => /[^A-Za-z0-9]/.test(p), label: 'رمز خاص (اختياري)' },
];

function getStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return score;
}

const STRENGTH_LABELS = ['', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية', 'ممتازة'];
const STRENGTH_COLORS = ['', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-green-500', 'bg-emerald-500'];

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = getStrength(form.new_password);
  const match = form.new_password && form.confirm && form.new_password === form.confirm;
  const canSubmit = form.current_password && form.new_password.length >= 8 && /[A-Z]/.test(form.new_password) && /[0-9]/.test(form.new_password) && match;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    try {
      await api.put('/auth/change-password', { current_password: form.current_password, new_password: form.new_password });
      toast.success('تم تغيير كلمة المرور بنجاح');
      navigate('/dashboard');
    } catch (err) {
      toast.error(err.response?.data?.error || 'خطأ في تغيير كلمة المرور');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-[#c9a84c]/10 flex items-center justify-center">
          <Shield size={24} className="text-[#c9a84c]" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-[#1a1a2e]">تغيير كلمة المرور</h1>
          <p className="text-xs text-gray-400">{user?.full_name}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        {/* Current password */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">كلمة المرور الحالية</label>
          <div className="relative">
            <input type={showCurrent ? 'text' : 'password'} value={form.current_password}
              onChange={e => setForm({ ...form, current_password: e.target.value })}
              className="form-input w-full pr-3 pl-10" dir="ltr" autoFocus />
            <button type="button" onClick={() => setShowCurrent(!showCurrent)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">كلمة المرور الجديدة</label>
          <div className="relative">
            <input type={showNew ? 'text' : 'password'} value={form.new_password}
              onChange={e => setForm({ ...form, new_password: e.target.value })}
              className="form-input w-full pr-3 pl-10" dir="ltr" />
            <button type="button" onClick={() => setShowNew(!showNew)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Strength bar */}
          {form.new_password && (
            <div className="mt-2">
              <div className="flex gap-1 mb-1">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength ? STRENGTH_COLORS[strength] : 'bg-gray-200'}`} />
                ))}
              </div>
              <p className={`text-[10px] ${strength >= 4 ? 'text-green-600' : strength >= 3 ? 'text-yellow-600' : 'text-red-500'}`}>
                {STRENGTH_LABELS[strength]}
              </p>
            </div>
          )}

          {/* Rules */}
          <div className="mt-3 space-y-1">
            {RULES.map((r, i) => {
              const pass = form.new_password ? r.test(form.new_password) : null;
              return (
                <div key={i} className={`flex items-center gap-2 text-[11px] ${pass === true ? 'text-green-600' : pass === false ? 'text-red-400' : 'text-gray-400'}`}>
                  {pass === true ? <CheckCircle size={12} /> : pass === false ? <XCircle size={12} /> : <div className="w-3 h-3 rounded-full border border-gray-300" />}
                  {r.label}
                </div>
              );
            })}
          </div>
        </div>

        {/* Confirm password */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">تأكيد كلمة المرور الجديدة</label>
          <input type="password" value={form.confirm}
            onChange={e => setForm({ ...form, confirm: e.target.value })}
            className="form-input w-full" dir="ltr" />
          {form.confirm && !match && (
            <p className="text-[11px] text-red-500 mt-1">كلمات المرور غير متطابقة</p>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => navigate(-1)} className="btn btn-ghost flex-1">إلغاء</button>
          <button type="submit" disabled={!canSubmit || loading} className="btn btn-gold flex-1">
            <Lock size={14} /> {loading ? 'جاري...' : 'تغيير كلمة المرور'}
          </button>
        </div>
      </form>
    </div>
  );
}
