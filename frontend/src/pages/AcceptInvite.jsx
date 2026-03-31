import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function AcceptInvite() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [status, setStatus] = useState('loading'); // loading | valid | invalid | accepted | error
  const [invite, setInvite] = useState(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    api.get(`/users/invite/validate/${token}`)
      .then(r => { setInvite(r.data); setStatus('valid'); })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || username.length < 3) {
      setError('اسم المستخدم يجب أن يكون 3 أحرف على الأقل');
      return;
    }
    if (password.length < 8) {
      setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
      return;
    }
    if (password !== confirmPassword) {
      setError('كلمات المرور غير متطابقة');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users/invite/accept', {
        token,
        username: username.trim(),
        full_name: fullName.trim() || username.trim(),
        password,
      });
      setStatus('accepted');
    } catch (err) {
      setError(err.response?.data?.error || 'حدث خطأ أثناء إنشاء الحساب');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-[#c9a84c] animate-spin" />
      </div>
    );
  }

  if (status === 'invalid') {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
        <div className="bg-[#1a1a2e] rounded-xl p-8 max-w-md w-full text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">رابط الدعوة غير صالح</h2>
          <p className="text-gray-400 text-sm mb-6">قد يكون الرابط منتهي الصلاحية أو تم استخدامه مسبقاً.</p>
          <button onClick={() => navigate('/login')}
            className="px-6 py-2 bg-[#c9a84c] text-white rounded-lg hover:bg-[#b8963f]">
            الذهاب لتسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  if (status === 'accepted') {
    return (
      <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
        <div className="bg-[#1a1a2e] rounded-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">تم إنشاء الحساب بنجاح!</h2>
          <p className="text-gray-400 text-sm mb-6">يمكنك الآن تسجيل الدخول باسم المستخدم وكلمة المرور.</p>
          <button onClick={() => navigate('/login')}
            className="px-6 py-2 bg-[#c9a84c] text-white rounded-lg hover:bg-[#b8963f]">
            تسجيل الدخول
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0d1a] flex items-center justify-center p-4">
      <div className="bg-[#1a1a2e] rounded-xl p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <UserPlus className="w-12 h-12 text-[#c9a84c] mx-auto mb-3" />
          <h2 className="text-xl font-bold text-white">قبول الدعوة</h2>
          {invite && (
            <p className="text-gray-400 text-sm mt-1">
              تمت دعوتك بصلاحية: <span className="text-[#c9a84c] font-medium">{invite.role}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-300 mb-1">اسم المستخدم</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-3 py-2 bg-[#0d0d1a] border border-gray-700 rounded-lg text-white text-sm"
              placeholder="اسم المستخدم" dir="ltr" required />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">الاسم الكامل</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 bg-[#0d0d1a] border border-gray-700 rounded-lg text-white text-sm"
              placeholder="الاسم الكامل (اختياري)" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">كلمة المرور</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 bg-[#0d0d1a] border border-gray-700 rounded-lg text-white text-sm pr-10"
                placeholder="كلمة المرور" dir="ltr" required />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500">
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-1">تأكيد كلمة المرور</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-[#0d0d1a] border border-gray-700 rounded-lg text-white text-sm"
              placeholder="أعد إدخال كلمة المرور" dir="ltr" required />
          </div>

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg px-3 py-2">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-[#c9a84c] text-white rounded-lg font-medium hover:bg-[#b8963f] disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            {submitting ? 'جاري إنشاء الحساب...' : 'إنشاء الحساب'}
          </button>
        </form>
      </div>
    </div>
  );
}
