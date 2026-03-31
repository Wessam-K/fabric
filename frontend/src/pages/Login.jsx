import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LogIn, Eye, EyeOff, Lock } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSeconds, setLockoutSeconds] = useState(0);
  const lockoutTimer = useRef(null);

  useEffect(() => {
    return () => { if (lockoutTimer.current) clearInterval(lockoutTimer.current); };
  }, []);

  useEffect(() => {
    if (lockoutSeconds > 0) {
      lockoutTimer.current = setInterval(() => {
        setLockoutSeconds(prev => {
          if (prev <= 1) { clearInterval(lockoutTimer.current); return 0; }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(lockoutTimer.current);
    }
  }, [lockoutSeconds > 0]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (lockoutSeconds > 0) return;
    setError('');
    setLoading(true);
    try {
      const data = await login(username, password);
      if (data.user?.must_change_password) {
        navigate('/change-password');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      const status = err.response?.status;
      if (!err.response && !status) {
        // Network error — backend might not be ready, retry once after delay
        try {
          await new Promise(r => setTimeout(r, 2000));
          const data = await login(username, password);
          if (data.user?.must_change_password) {
            navigate('/change-password');
          } else {
            navigate('/dashboard');
          }
          return;
        } catch (retryErr) {
          const retryStatus = retryErr.response?.status;
          const retryMsg = retryErr.response?.data?.error || 'الخادم غير جاهز — يرجى الانتظار ثوان والمحاولة مرة أخرى';
          setError(retryMsg);
          if (retryStatus === 423) {
            const minsMatch = retryMsg.match(/(\d+)\s*دقيقة/);
            if (minsMatch) setLockoutSeconds(parseInt(minsMatch[1]) * 60);
            else setLockoutSeconds(15 * 60);
          }
          setLoading(false);
          return;
        }
      }
      const msg = err.response?.data?.error || 'حدث خطأ في الاتصال';
      setError(msg);
      if (status === 423) {
        const minsMatch = msg.match(/(\d+)\s*دقيقة/);
        if (minsMatch) setLockoutSeconds(parseInt(minsMatch[1]) * 60);
        else setLockoutSeconds(15 * 60);
      }
    } finally {
      setLoading(false);
    }
  }

  const formatCountdown = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-[#1a1a2e] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#c9a84c]">WK-Factory</h1>
          <p className="text-gray-400 mt-2">نظام إدارة المصنع</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-2xl p-8 space-y-6 border border-white/10">
          <h2 className="text-xl font-semibold text-white text-center">تسجيل الدخول</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 text-red-300 px-4 py-3 rounded-xl text-sm text-center">{error}</div>
          )}

          {lockoutSeconds > 0 && (
            <div className="bg-amber-500/20 border border-amber-500/50 text-amber-300 px-4 py-3 rounded-xl text-center">
              <Lock size={18} className="inline ml-2" />
              <span className="text-sm">الحساب مقفل — يمكنك المحاولة بعد </span>
              <span className="font-mono font-bold text-lg">{formatCountdown(lockoutSeconds)}</span>
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-300 mb-2">اسم المستخدم</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required autoFocus
              className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors"
              placeholder="ahmed.manager" dir="ltr" />
          </div>

          <div>
            <label className="block text-sm text-gray-300 mb-2">كلمة المرور</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full px-4 pl-10 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#c9a84c] transition-colors"
                placeholder="••••••••" dir="ltr" />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading || lockoutSeconds > 0}
            className="w-full py-3 bg-[#c9a84c] text-[#1a1a2e] font-semibold rounded-xl hover:bg-[#d4b85c] transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
            <LogIn size={18} />
            {loading ? 'جاري الدخول...' : lockoutSeconds > 0 ? `مقفل (${formatCountdown(lockoutSeconds)})` : 'تسجيل الدخول'}
          </button>
        </form>

        <p className="text-center text-gray-600 text-xs mt-6">WK-Factory v{__APP_VERSION__} — نظام إدارة المصنع</p>
      </div>
    </div>
  );
}
