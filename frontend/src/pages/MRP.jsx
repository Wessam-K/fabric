import { useState, useEffect } from 'react';
import { Plus, Search, Play, Package, AlertTriangle, ShoppingCart, Eye, X } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { fmtDateTime } from '../utils/formatters';
import Tooltip from '../components/Tooltip';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import HelpButton from '../components/HelpButton';

const STATUS_COLORS = { draft: 'bg-gray-100 text-gray-700', running: 'bg-blue-100 text-blue-700', confirmed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700' };
const STATUS_LABELS = { draft: 'مسودة', running: 'قيد التنفيذ', confirmed: 'مؤكد', cancelled: 'ملغي' };

export default function MRP() {
  const toast = useToast();
  const { can } = useAuth();
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showDetail, setShowDetail] = useState(false);
  const [calculating, setCalculating] = useState(false);

  const loadRuns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/mrp');
      setRuns(data || []);
    } catch { toast.error('فشل تحميل عمليات MRP'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadRuns(); }, []);

  const runMRP = async () => {
    setCalculating(true);
    try {
      const { data } = await api.post('/mrp/calculate');
      toast.success(`تم حساب MRP — ${data.suggestion_count} اقتراح`);
      loadRuns();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل حساب MRP'); }
    finally { setCalculating(false); }
  };

  const viewRun = async (id) => {
    try {
      const { data } = await api.get(`/mrp/${id}`);
      setSelectedRun(data);
      setSuggestions(data.suggestions || []);
      setShowDetail(true);
    } catch { toast.error('فشل تحميل التفاصيل'); }
  };

  const autoPO = async (id) => {
    try {
      const { data } = await api.post(`/mrp/${id}/auto-po`);
      toast.success(`تم إنشاء ${data.po_count} أمر شراء`);
      loadRuns();
      setShowDetail(false);
    } catch (err) { toast.error(err.response?.data?.error || 'فشل إنشاء أوامر الشراء'); }
  };

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="تخطيط الاحتياجات — MRP" icon={Package} count={runs.length} action={<HelpButton pageKey="mrp" />} />

      <div className="flex flex-wrap gap-3 mb-6">
        <PermissionGuard module="mrp" action="create">
          <button onClick={runMRP} disabled={calculating}
            className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f] disabled:opacity-50">
            <Play size={18} /> {calculating ? 'جاري الحساب...' : 'تشغيل MRP'}
          </button>
        </PermissionGuard>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border">
          <Package size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">لا توجد عمليات MRP بعد</p>
          <p className="text-gray-400 text-sm mt-1">اضغط "تشغيل MRP" لحساب الاحتياجات</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="p-3 text-right">رقم العملية</th>
                  <th className="p-3 text-right">التاريخ</th>
                  <th className="p-3 text-center">أوامر العمل</th>
                  <th className="p-3 text-center">الاقتراحات</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {runs.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold text-[#1a1a2e]">{r.run_number}</td>
                    <td className="p-3 text-gray-600">{fmtDateTime(r.run_date)}</td>
                    <td className="p-3 text-center">{r.work_order_count}</td>
                    <td className="p-3 text-center">
                      <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full text-xs font-bold">
                        {r.suggestion_count}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[r.status] || 'bg-gray-100'}`}>
                        {STATUS_LABELS[r.status] || r.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        <Tooltip text="عرض"><button onClick={() => viewRun(r.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                          <Eye size={16} />
                        </button></Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selectedRun && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold">تفاصيل MRP — {selectedRun.run_number}</h2>
                <p className="text-sm text-gray-500">{fmtDateTime(selectedRun.run_date)} • {suggestions.length} اقتراح</p>
              </div>
              <div className="flex gap-2">
                {selectedRun.status === 'draft' && (
                  <button onClick={() => autoPO(selectedRun.id)}
                    className="flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:bg-green-700">
                    <ShoppingCart size={14} /> إنشاء أوامر شراء
                  </button>
                )}
                <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh]">
              {suggestions.length === 0 ? (
                <p className="text-center py-8 text-gray-400">لا توجد نواقص — المخزون كافٍ</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="p-2 text-right">النوع</th>
                      <th className="p-2 text-right">الكود</th>
                      <th className="p-2 text-center">الكمية المطلوبة</th>
                      <th className="p-2 text-center">المتاح</th>
                      <th className="p-2 text-center">قيد الطلب</th>
                      <th className="p-2 text-center">النقص</th>
                      <th className="p-2 text-right">المورد المقترح</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {suggestions.map(s => (
                      <tr key={s.id} className="hover:bg-yellow-50">
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.item_type === 'fabric' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                            {s.item_type === 'fabric' ? 'قماش' : 'اكسسوار'}
                          </span>
                        </td>
                        <td className="p-2 font-mono font-bold">{s.item_code}</td>
                        <td className="p-2 text-center">{s.required_qty}</td>
                        <td className="p-2 text-center text-green-600">{s.on_hand_qty}</td>
                        <td className="p-2 text-center text-blue-600">{s.on_order_qty}</td>
                        <td className="p-2 text-center">
                          <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold">{s.shortage_qty}</span>
                        </td>
                        <td className="p-2 text-gray-600">{s.suggested_supplier || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
