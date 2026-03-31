import { useState, useEffect } from 'react';
import { Plus, Search, Shield, ClipboardCheck, AlertTriangle, Eye, X, CheckCircle, XCircle } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import Pagination from '../components/Pagination';
import PermissionGuard from '../components/PermissionGuard';
import { useAuth } from '../context/AuthContext';
import HelpButton from '../components/HelpButton';

const TABS = [
  { key: 'inspections', label: 'الفحوصات', icon: ClipboardCheck },
  { key: 'templates', label: 'القوالب', icon: Shield },
  { key: 'ncr', label: 'عدم المطابقة', icon: AlertTriangle },
  { key: 'defects', label: 'أكواد العيوب', icon: XCircle },
];
const STATUS_COLORS = { in_progress: 'bg-yellow-100 text-yellow-700', completed: 'bg-green-100 text-green-700', cancelled: 'bg-red-100 text-red-700', open: 'bg-red-100 text-red-700', investigating: 'bg-yellow-100 text-yellow-700', closed: 'bg-green-100 text-green-700' };
const STATUS_LABELS = { in_progress: 'قيد الفحص', completed: 'مكتمل', cancelled: 'ملغي', open: 'مفتوح', investigating: 'قيد التحقيق', closed: 'مغلق' };

export default function Quality() {
  const toast = useToast();
  const { can } = useAuth();
  const [tab, setTab] = useState('inspections');

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto">
      <PageHeader title="مراقبة الجودة" icon={Shield} action={<HelpButton pageKey="quality" />} />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white shadow text-[#1a1a2e]' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'inspections' && <InspectionsTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'ncr' && <NCRTab />}
      {tab === 'defects' && <DefectsTab />}
    </div>
  );
}

// ═══════════════════════════════════════════════
// INSPECTIONS TAB
// ═══════════════════════════════════════════════
function InspectionsTab() {
  const toast = useToast();
  const { can } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState({ work_order_id: '', template_id: '', inspection_type: 'inline', sample_size: 0, items: [] });
  const [workOrders, setWorkOrders] = useState([]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/quality/inspections', { params: { page, limit: 25, status: statusFilter } });
      setInspections(data.data || []);
      setTotal(data.total || 0);
    } catch { toast.error('فشل تحميل الفحوصات'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page, statusFilter]);
  useEffect(() => {
    api.get('/quality/templates').then(r => setTemplates(r.data || [])).catch(() => {});
    api.get('/work-orders', { params: { limit: 100 } }).then(r => setWorkOrders(r.data?.data || [])).catch(() => {});
  }, []);

  const selectTemplate = async (tid) => {
    setForm(f => ({ ...f, template_id: tid }));
    if (tid) {
      try {
        const { data } = await api.get(`/quality/templates/${tid}`);
        setForm(f => ({ ...f, items: (data.items || []).map(i => ({ template_item_id: i.id, check_point: i.check_point, result: 'pending', measured_value: '', notes: '' })) }));
      } catch {}
    }
  };

  const save = async () => {
    try {
      await api.post('/quality/inspections', form);
      toast.success('تم إنشاء الفحص');
      setShowModal(false);
      setForm({ work_order_id: '', template_id: '', inspection_type: 'inline', sample_size: 0, items: [] });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل الحفظ'); }
  };

  const viewDetail = async (id) => {
    try {
      const { data } = await api.get(`/quality/inspections/${id}`);
      setSelected(data);
      setShowDetail(true);
    } catch { toast.error('فشل التحميل'); }
  };

  const completeInspection = async (result) => {
    try {
      const passed = selected.items?.filter(i => i.result === 'pass').length || 0;
      const failed = selected.items?.filter(i => i.result === 'fail').length || 0;
      await api.patch(`/quality/inspections/${selected.id}/complete`, { result, passed_qty: passed, failed_qty: failed });
      toast.success('تم إكمال الفحص');
      setShowDetail(false);
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="border rounded-lg px-3 py-2 text-sm">
          <option value="">كل الحالات</option>
          <option value="in_progress">قيد الفحص</option>
          <option value="completed">مكتمل</option>
        </select>
        <PermissionGuard module="quality" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]">
            <Plus size={18} /> فحص جديد
          </button>
        </PermissionGuard>
      </div>

      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : inspections.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><ClipboardCheck size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد فحوصات</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr><th className="p-3 text-right">رقم الفحص</th><th className="p-3 text-right">أمر العمل</th><th className="p-3 text-right">القالب</th><th className="p-3 text-right">الفاحص</th><th className="p-3 text-center">النتيجة</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr>
              </thead>
              <tbody className="divide-y">
                {inspections.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="p-3 font-mono font-bold">{i.inspection_number}</td>
                    <td className="p-3 text-gray-600">{i.wo_number || '-'}</td>
                    <td className="p-3 text-gray-600">{i.template_name || '-'}</td>
                    <td className="p-3 text-gray-600">{i.inspector_name || '-'}</td>
                    <td className="p-3 text-center">
                      {i.result === 'pass' && <span className="text-green-600 font-bold">ناجح</span>}
                      {i.result === 'fail' && <span className="text-red-600 font-bold">فاشل</span>}
                      {!i.result && <span className="text-gray-400">-</span>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[i.status] || 'bg-gray-100'}`}>{STATUS_LABELS[i.status] || i.status}</span>
                    </td>
                    <td className="p-3 text-center"><button onClick={() => viewDetail(i.id)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Eye size={16} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}

      {/* Create Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">فحص جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">أمر العمل *</label>
                  <select value={form.work_order_id} onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— اختر —</option>
                    {workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.wo_number}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">القالب</label>
                  <select value={form.template_id} onChange={e => selectTemplate(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">— بدون قالب —</option>
                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">نوع الفحص</label>
                  <select value={form.inspection_type} onChange={e => setForm(f => ({ ...f, inspection_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="inline">أثناء الإنتاج</option>
                    <option value="final">نهائي</option>
                    <option value="incoming">وارد</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">حجم العينة</label>
                  <input type="number" value={form.sample_size} onChange={e => setForm(f => ({ ...f, sample_size: parseInt(e.target.value) || 0 }))} className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              {form.items.length > 0 && (
                <div>
                  <label className="block text-sm font-bold mb-2">نقاط الفحص</label>
                  {form.items.map((it, i) => (
                    <div key={i} className="flex gap-2 mb-2 items-center bg-gray-50 p-2 rounded-lg">
                      <span className="text-sm flex-1">{it.check_point}</span>
                      <select value={it.result} onChange={e => { const items = [...form.items]; items[i].result = e.target.value; setForm(f => ({ ...f, items })); }}
                        className="border rounded px-2 py-1 text-xs">
                        <option value="pending">قيد الفحص</option>
                        <option value="pass">ناجح</option>
                        <option value="fail">فاشل</option>
                      </select>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetail && selected && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <div>
                <h2 className="text-lg font-bold">{selected.inspection_number}</h2>
                <p className="text-sm text-gray-500">{selected.wo_number} • {selected.template_name || 'بدون قالب'}</p>
              </div>
              <div className="flex gap-2 items-center">
                {selected.status === 'in_progress' && can('quality', 'edit') && (
                  <>
                    <button onClick={() => completeInspection('pass')} className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm"><CheckCircle size={14} /> ناجح</button>
                    <button onClick={() => completeInspection('fail')} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm"><XCircle size={14} /> فاشل</button>
                  </>
                )}
                <button onClick={() => setShowDetail(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
              </div>
            </div>
            <div className="p-5 overflow-y-auto max-h-[65vh]">
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">الحالة</p><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[selected.status]}`}>{STATUS_LABELS[selected.status]}</span></div>
                <div className="bg-gray-50 p-3 rounded-lg"><p className="text-xs text-gray-500">النتيجة</p><p className="font-bold">{selected.result === 'pass' ? 'ناجح ✓' : selected.result === 'fail' ? 'فاشل ✗' : '-'}</p></div>
                <div className="bg-green-50 p-3 rounded-lg"><p className="text-xs text-gray-500">ناجح</p><p className="font-bold text-green-600">{selected.passed_qty || 0}</p></div>
                <div className="bg-red-50 p-3 rounded-lg"><p className="text-xs text-gray-500">فاشل</p><p className="font-bold text-red-600">{selected.failed_qty || 0}</p></div>
              </div>
              {selected.items?.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50"><tr><th className="p-2 text-right">نقطة الفحص</th><th className="p-2 text-center">النتيجة</th><th className="p-2 text-right">القياس</th><th className="p-2 text-right">العيب</th></tr></thead>
                  <tbody className="divide-y">
                    {selected.items.map(it => (
                      <tr key={it.id}>
                        <td className="p-2">{it.check_point}</td>
                        <td className="p-2 text-center">
                          {it.result === 'pass' ? <CheckCircle size={16} className="text-green-500 mx-auto" /> : it.result === 'fail' ? <XCircle size={16} className="text-red-500 mx-auto" /> : <span className="text-gray-400">-</span>}
                        </td>
                        <td className="p-2 text-gray-600">{it.measured_value || '-'}</td>
                        <td className="p-2 text-gray-600">{it.defect_name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// TEMPLATES TAB
// ═══════════════════════════════════════════════
function TemplatesTab() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', product_type: '', items: [{ check_point: '', check_type: 'pass_fail', acceptable_range: '' }] });

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/quality/templates'); setTemplates(data || []); }
    catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const addItem = () => setForm(f => ({ ...f, items: [...f.items, { check_point: '', check_type: 'pass_fail', acceptable_range: '' }] }));

  const save = async () => {
    try { await api.post('/quality/templates', form); toast.success('تم حفظ القالب'); setShowModal(false); setForm({ name: '', description: '', items: [{ check_point: '', criteria: '', sort_order: 0 }] }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <PermissionGuard module="quality" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]"><Plus size={18} /> قالب جديد</button>
        </PermissionGuard>
      </div>
      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : templates.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><Shield size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد قوالب</p></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <div key={t.id} className="bg-white rounded-xl border p-4">
              <h3 className="font-bold text-lg mb-1">{t.name}</h3>
              <p className="text-sm text-gray-500 mb-2">{t.description || 'بدون وصف'}</p>
              <div className="flex items-center gap-2">
                <span className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded text-xs">{t.item_count} نقطة فحص</span>
                {t.product_type && <span className="bg-gray-50 text-gray-600 px-2 py-0.5 rounded text-xs">{t.product_type}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">قالب فحص جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">الاسم *</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
                <div><label className="block text-sm font-medium mb-1">نوع المنتج</label><input value={form.product_type} onChange={e => setForm(f => ({ ...f, product_type: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">الوصف</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div>
                <div className="flex justify-between items-center mb-2"><label className="text-sm font-bold">نقاط الفحص</label><button onClick={addItem} className="text-xs text-[#c9a84c] hover:underline">+ إضافة</button></div>
                {form.items.map((it, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <input placeholder="نقطة الفحص" value={it.check_point} onChange={e => { const items = [...form.items]; items[i].check_point = e.target.value; setForm(f => ({ ...f, items })); }} className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                    <select value={it.check_type} onChange={e => { const items = [...form.items]; items[i].check_type = e.target.value; setForm(f => ({ ...f, items })); }} className="border rounded-lg px-2 py-2 text-sm">
                      <option value="pass_fail">ناجح/فاشل</option>
                      <option value="measurement">قياس</option>
                      <option value="visual">بصري</option>
                    </select>
                    <input placeholder="النطاق المقبول" value={it.acceptable_range} onChange={e => { const items = [...form.items]; items[i].acceptable_range = e.target.value; setForm(f => ({ ...f, items })); }} className="w-32 border rounded-lg px-3 py-2 text-sm" />
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// NCR TAB
// ═══════════════════════════════════════════════
function NCRTab() {
  const toast = useToast();
  const { can } = useAuth();
  const [ncrs, setNcrs] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', severity: 'minor', work_order_id: '', root_cause: '', corrective_action: '', preventive_action: '' });
  const [workOrders, setWorkOrders] = useState([]);

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/quality/ncr', { params: { page, limit: 25 } }); setNcrs(data.data || []); setTotal(data.total || 0); }
    catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [page]);
  useEffect(() => { api.get('/work-orders', { params: { limit: 100 } }).then(r => setWorkOrders(r.data?.data || [])).catch(() => {}); }, []);

  const save = async () => {
    try { await api.post('/quality/ncr', form); toast.success('تم إنشاء تقرير عدم المطابقة'); setShowModal(false); setForm({ work_order_id: '', inspection_id: '', severity: 'minor', description: '', corrective_action: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  const updateStatus = async (id, status) => {
    try { await api.patch(`/quality/ncr/${id}`, { status }); toast.success('تم التحديث'); load(); }
    catch { toast.error('فشل التحديث'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <PermissionGuard module="quality" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]"><Plus size={18} /> تقرير جديد</button>
        </PermissionGuard>
      </div>
      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : ncrs.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border"><AlertTriangle size={48} className="mx-auto mb-4 text-gray-300" /><p className="text-gray-500">لا توجد تقارير عدم مطابقة</p></div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3 text-right">الرقم</th><th className="p-3 text-right">العنوان</th><th className="p-3 text-right">أمر العمل</th><th className="p-3 text-center">الخطورة</th><th className="p-3 text-center">الحالة</th><th className="p-3 text-center">إجراءات</th></tr></thead>
            <tbody className="divide-y">
              {ncrs.map(n => (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold">{n.ncr_number}</td>
                  <td className="p-3">{n.title}</td>
                  <td className="p-3 text-gray-600">{n.wo_number || '-'}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${n.severity === 'critical' ? 'bg-red-100 text-red-700' : n.severity === 'major' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{n.severity}</span></td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${STATUS_COLORS[n.status]}`}>{STATUS_LABELS[n.status] || n.status}</span></td>
                  <td className="p-3 text-center">
                    {can('quality', 'edit') && n.status === 'open' && <button onClick={() => updateStatus(n.id, 'investigating')} className="text-xs bg-yellow-500 text-white px-2 py-1 rounded">تحقيق</button>}
                    {can('quality', 'edit') && n.status === 'investigating' && <button onClick={() => updateStatus(n.id, 'closed')} className="text-xs bg-green-600 text-white px-2 py-1 rounded">إغلاق</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination current={page} total={total} pageSize={25} onChange={setPage} />
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">تقرير عدم مطابقة جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div><label className="block text-sm font-medium mb-1">العنوان *</label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">أمر العمل</label><select value={form.work_order_id} onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="">—</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.wo_number}</option>)}</select></div>
                <div><label className="block text-sm font-medium mb-1">الخطورة</label><select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="minor">بسيط</option><option value="major">متوسط</option><option value="critical">حرج</option></select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">الوصف</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div><label className="block text-sm font-medium mb-1">السبب الجذري</label><textarea value={form.root_cause} onChange={e => setForm(f => ({ ...f, root_cause: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
              <div><label className="block text-sm font-medium mb-1">الإجراء التصحيحي</label><textarea value={form.corrective_action} onChange={e => setForm(f => ({ ...f, corrective_action: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" rows={2} /></div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════
// DEFECTS TAB
// ═══════════════════════════════════════════════
function DefectsTab() {
  const toast = useToast();
  const [codes, setCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ code: '', name_ar: '', severity: 'minor', category: '' });

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/quality/defect-codes'); setCodes(data || []); }
    catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    try { await api.post('/quality/defect-codes', form); toast.success('تم الحفظ'); setShowModal(false); setForm({ code: '', name_ar: '', severity: 'minor', category: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'فشل'); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <PermissionGuard module="quality" action="create">
          <button onClick={() => setShowModal(true)} className="flex items-center gap-2 bg-[#c9a84c] text-[#1a1a2e] px-4 py-2 rounded-lg font-bold hover:bg-[#b8973f]"><Plus size={18} /> كود عيب جديد</button>
        </PermissionGuard>
      </div>
      {loading ? <div className="text-center py-12 text-gray-400">جاري التحميل...</div> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50"><tr><th className="p-3 text-right">الكود</th><th className="p-3 text-right">الاسم</th><th className="p-3 text-right">EN</th><th className="p-3 text-center">الخطورة</th><th className="p-3 text-right">الفئة</th></tr></thead>
            <tbody className="divide-y">
              {codes.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-bold">{c.code}</td>
                  <td className="p-3">{c.name_ar}</td>
                  <td className="p-3 text-gray-500">{c.name_en || '-'}</td>
                  <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${c.severity === 'critical' ? 'bg-red-100 text-red-700' : c.severity === 'major' ? 'bg-orange-100 text-orange-700' : 'bg-yellow-100 text-yellow-700'}`}>{c.severity}</span></td>
                  <td className="p-3 text-gray-600">{c.category || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center p-5 border-b bg-gray-50">
              <h2 className="text-lg font-bold">كود عيب جديد</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 hover:bg-gray-200 rounded-lg"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">الكود *</label><input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="D011" /></div>
                <div><label className="block text-sm font-medium mb-1">الخطورة</label><select value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm"><option value="minor">بسيط</option><option value="major">متوسط</option><option value="critical">حرج</option></select></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">الاسم بالعربية *</label><input value={form.name_ar} onChange={e => setForm(f => ({ ...f, name_ar: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" /></div>
              <div><label className="block text-sm font-medium mb-1">الفئة</label><input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="خياطة، قص..." /></div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">إلغاء</button>
              <button onClick={save} className="px-4 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-lg font-bold hover:bg-[#b8973f]">حفظ</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
