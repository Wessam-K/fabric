import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Printer, Edit2, Trash2 } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';

export default function ModelsList() {
  const navigate = useNavigate();
  const toast = useToast();
  const [models, setModels] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchModels = async () => {
    try {
      const { data } = await axios.get('/api/models', { params: search ? { search } : {} });
      setModels(data);
    } catch (err) {
      toast.error('فشل تحميل الموديلات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchModels(); }, [search]);

  const handleDelete = async (code) => {
    if (!confirm('هل تريد إلغاء تفعيل هذا الموديل؟')) return;
    try {
      await axios.delete(`/api/models/${code}`);
      toast.success('تم إلغاء تفعيل الموديل');
      fetchModels();
    } catch { toast.error('فشل الحذف'); }
  };

  const fmt = (v) => (v || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-[#1a1a2e]">قائمة الموديلات</h2>
        <button onClick={() => navigate('/models/new')}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors">
          <Plus size={16} /> موديل جديد
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالكود أو الاسم أو التسلسلي..."
          className="w-full border border-gray-300 rounded-lg pr-9 pl-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" />
        </div>
      ) : models.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-lg mb-2">لا توجد موديلات</p>
          <p className="text-sm">ابدأ بإنشاء موديل جديد</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {models.map(m => (
            <div key={m.model_code}
              className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-5 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/models/${m.model_code}/edit`)}>
              {/* Image */}
              <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                {m.model_image ? (
                  <img src={m.model_image} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl text-gray-300">📷</span>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{m.serial_number}</span>
                  <span className="font-mono text-sm font-bold text-[#1a1a2e]">{m.model_code}</span>
                </div>
                {m.model_name && <p className="text-sm text-gray-600 mt-0.5 truncate">{m.model_name}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(m.created_at).toLocaleDateString('ar-EG')}</p>
              </div>

              {/* Cost Badge */}
              <div className="text-left shrink-0">
                <p className="text-[10px] text-gray-400">تكلفة القطعة</p>
                <p className="font-mono font-bold text-[#c9a84c] text-lg">{fmt(m.cost_summary?.cost_per_piece)}</p>
                <p className="text-[10px] text-gray-400">{m.cost_summary?.grand_total_pieces || 0} قطعة</p>
              </div>

              {/* Actions */}
              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button onClick={() => navigate(`/models/${m.model_code}/edit`)}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors">
                  <Edit2 size={16} />
                </button>
                <button onClick={() => window.open(`/models/${m.model_code}/print`, '_blank')}
                  className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-lg transition-colors">
                  <Printer size={16} />
                </button>
                <button onClick={() => handleDelete(m.model_code)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
