import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <AlertTriangle size={56} className="text-[#c9a84c] mb-4" />
      <h1 className="text-7xl font-bold text-[#1a1a2e] font-[JetBrains_Mono] mb-2">404</h1>
      <p className="text-lg text-gray-500 mb-6">الصفحة غير موجودة</p>
      <p className="text-sm text-gray-400 mb-8">الصفحة التي تبحث عنها غير متوفرة أو تم نقلها</p>
      <button onClick={() => navigate('/dashboard')} className="btn btn-gold flex items-center gap-2">
        <Home size={16} /> العودة للوحة التحكم
      </button>
    </div>
  );
}
