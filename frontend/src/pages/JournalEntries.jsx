import { useState, useEffect } from 'react';
import { Plus, Eye, CheckCircle, XCircle, Search, FileText, Download } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useToast } from '../components/Toast';
import Tooltip from '../components/Tooltip';
import { fmtDate, downloadCSV } from '../utils/formatters';

const STATUS_MAP = { draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' }, posted: { label: 'مرحّل', color: 'bg-green-100 text-green-600' }, void: { label: 'ملغى', color: 'bg-red-100 text-red-600' } };

export default function JournalEntries() {
  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [view, setView] = useState(null); // entry detail
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ entry_number: '', entry_date: new Date().toISOString().slice(0, 10), description: '', reference: '', lines: [{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }] });
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const [entriesRes, coaRes] = await Promise.all([api.get('/accounting/journal', { params }), api.get('/accounting/coa')]);
      const eData = entriesRes.data;
      setEntries(Array.isArray(eData) ? eData : (eData.data || []));
      setAccounts(coaRes.data.filter(a => a.is_active));
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [search, statusFilter, dateFrom, dateTo]);

  const openNew = async () => {
    try {
      const { data } = await api.get('/accounting/journal/next-number');
      setForm({ entry_number: data.next, entry_date: new Date().toISOString().slice(0, 10), description: '', reference: '', lines: [{ account_id: '', debit: '', credit: '', description: '' }, { account_id: '', debit: '', credit: '', description: '' }] });
      setShowForm(true); setView(null);
    } catch { toast.error('فشل جلب الرقم'); }
  };

  const addLine = () => setForm({ ...form, lines: [...form.lines, { account_id: '', debit: '', credit: '', description: '' }] });
  const removeLine = (i) => { if (form.lines.length <= 2) return; setForm({ ...form, lines: form.lines.filter((_, idx) => idx !== i) }); };
  const updateLine = (i, field, val) => { const lines = [...form.lines]; lines[i] = { ...lines[i], [field]: val }; setForm({ ...form, lines }); };

  const totalDebit = form.lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = form.lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSave = async () => {
    if (!isBalanced) return toast.error('القيد غير متوازن');
    try {
      const payload = { ...form, lines: form.lines.filter(l => l.account_id).map(l => ({ ...l, debit: parseFloat(l.debit) || 0, credit: parseFloat(l.credit) || 0 })) };
      await api.post('/accounting/journal', payload);
      toast.success('تم إنشاء القيد');
      setShowForm(false); load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handlePost = async (id) => {
    try {
      await api.patch(`/accounting/journal/${id}/post`);
      toast.success('تم الترحيل');
      if (view?.id === id) { const { data } = await api.get(`/accounting/journal/${id}`); setView(data); }
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const handleVoid = async (id) => {
    try {
      await api.patch(`/accounting/journal/${id}/void`);
      toast.success('تم الإلغاء');
      if (view?.id === id) { const { data } = await api.get(`/accounting/journal/${id}`); setView(data); }
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const openView = async (id) => {
    try {
      const { data } = await api.get(`/accounting/journal/${id}`);
      setView(data); setShowForm(false);
    } catch { toast.error('فشل التحميل'); }
  };

  return (
    <div className="page">
      <PageHeader title="القيود اليومية" subtitle={`${entries.length} قيد`}
        actions={<div className="flex items-center gap-2"><HelpButton pageKey="journalentries" /><button onClick={openNew} className="btn btn-primary"><Plus size={14} /> قيد جديد</button></div>}
      />

      {/* Entry detail view */}
      {view && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-bold text-[#1a1a2e]">{view.entry_number}</h3>
              <p className="text-xs text-gray-400">{fmtDate(view.entry_date)} · {view.created_by_name}</p>
              {view.description && <p className="text-sm text-gray-600 mt-1">{view.description}</p>}
            </div>
            <div className="flex gap-2 items-center">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_MAP[view.status]?.color}`}>{STATUS_MAP[view.status]?.label}</span>
              {view.status === 'draft' && (
                <>
                  <button onClick={() => handlePost(view.id)} className="btn btn-primary text-xs"><CheckCircle size={12} /> ترحيل</button>
                  <button onClick={() => handleVoid(view.id)} className="btn btn-ghost text-xs text-red-500"><XCircle size={12} /> إلغاء</button>
                </>
              )}
              <button onClick={() => setView(null)} className="btn btn-ghost text-xs">✕ إغلاق</button>
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-right text-xs text-gray-500">الحساب</th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">البيان</th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">مدين</th>
                <th className="px-4 py-2 text-center text-xs text-gray-500">دائن</th>
              </tr>
            </thead>
            <tbody>
              {view.lines?.map((l, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-4 py-2 font-bold">{l.account_code} — {l.account_name}</td>
                  <td className="px-4 py-2 text-center text-xs text-gray-500">{l.description || '—'}</td>
                  <td className="px-4 py-2 text-center font-mono">{l.debit ? l.debit.toLocaleString('ar-EG') : ''}</td>
                  <td className="px-4 py-2 text-center font-mono">{l.credit ? l.credit.toLocaleString('ar-EG') : ''}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-[#1a1a2e] font-bold">
                <td colSpan={2} className="px-4 py-2 text-left">الإجمالي</td>
                <td className="px-4 py-2 text-center font-mono">{view.lines?.reduce((s, l) => s + (l.debit || 0), 0).toLocaleString('ar-EG')}</td>
                <td className="px-4 py-2 text-center font-mono">{view.lines?.reduce((s, l) => s + (l.credit || 0), 0).toLocaleString('ar-EG')}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* New entry form */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 space-y-4">
          <h3 className="font-bold text-[#1a1a2e]">قيد يومية جديد</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">رقم القيد</label>
              <input type="text" value={form.entry_number} onChange={e => setForm({ ...form, entry_number: e.target.value })} className="form-input w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500">التاريخ</label>
              <input type="date" value={form.entry_date} onChange={e => setForm({ ...form, entry_date: e.target.value })} className="form-input w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500">البيان</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="form-input w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500">المرجع</label>
              <input type="text" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className="form-input w-full" />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-bold text-gray-600">السطور</h4>
              <button onClick={addLine} className="text-xs text-[#c9a84c] hover:underline">+ سطر جديد</button>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-right text-xs text-gray-500">الحساب</th>
                  <th className="px-3 py-2 text-center text-xs text-gray-500">البيان</th>
                  <th className="px-3 py-2 text-center text-xs text-gray-500 w-28">مدين</th>
                  <th className="px-3 py-2 text-center text-xs text-gray-500 w-28">دائن</th>
                  <th className="px-3 py-2 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {form.lines.map((line, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-3 py-1">
                      <select value={line.account_id} onChange={e => updateLine(i, 'account_id', e.target.value)} className="form-select w-full text-xs">
                        <option value="">— اختر —</option>
                        {accounts.map(a => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-1"><input type="text" value={line.description} onChange={e => updateLine(i, 'description', e.target.value)} className="form-input w-full text-xs" /></td>
                    <td className="px-3 py-1"><input type="number" min="0" step="0.01" value={line.debit} onChange={e => updateLine(i, 'debit', e.target.value)} className="form-input w-full text-xs text-center font-mono" /></td>
                    <td className="px-3 py-1"><input type="number" min="0" step="0.01" value={line.credit} onChange={e => updateLine(i, 'credit', e.target.value)} className="form-input w-full text-xs text-center font-mono" /></td>
                    <td className="px-3 py-1"><button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button></td>
                  </tr>
                ))}
                <tr className="border-t-2 border-gray-300 font-bold">
                  <td colSpan={2} className="px-3 py-2 text-left text-xs">الإجمالي</td>
                  <td className={`px-3 py-2 text-center font-mono text-xs ${isBalanced ? 'text-green-600' : 'text-red-500'}`}>{totalDebit.toLocaleString('ar-EG')}</td>
                  <td className={`px-3 py-2 text-center font-mono text-xs ${isBalanced ? 'text-green-600' : 'text-red-500'}`}>{totalCredit.toLocaleString('ar-EG')}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
            {!isBalanced && totalDebit > 0 && <p className="text-xs text-red-500">⚠ القيد غير متوازن — الفرق: {Math.abs(totalDebit - totalCredit).toLocaleString('ar-EG')}</p>}
          </div>

          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!isBalanced} className="btn btn-primary disabled:opacity-40"><FileText size={14} /> حفظ القيد</button>
            <button onClick={() => setShowForm(false)} className="btn btn-ghost">إلغاء</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="form-input w-full pr-8" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-select text-xs">
          <option value="">كل الحالات</option>
          <option value="draft">مسودة</option>
          <option value="posted">مرحّل</option>
          <option value="void">ملغى</option>
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-input text-xs w-36" title="من تاريخ" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-input text-xs w-36" title="إلى تاريخ" />
        <button onClick={() => {
          const rows = entries.map(e => ({
            'رقم القيد': e.entry_number, 'التاريخ': e.entry_date, 'الوصف': e.description,
            'الحالة': STATUS_MAP[e.status]?.label || e.status, 'المدين': e.total_debit || 0, 'الدائن': e.total_credit || 0
          }));
          downloadCSV(rows, 'journal-entries');
        }} className="btn btn-secondary text-xs"><Download size={14} /> تصدير</button>
      </div>

      {selectedIds.length > 0 && (
        <div className="mb-3 flex items-center gap-3 bg-[#c9a84c]/10 border border-[#c9a84c]/30 rounded-xl px-4 py-2">
          <span className="text-sm font-bold text-[#1a1a2e]">{selectedIds.length} محدد</span>
          <button onClick={() => setSelectedIds([])} className="text-xs text-gray-500 hover:text-red-500">إلغاء التحديد</button>
        </div>
      )}

      {loading ? <LoadingState /> : (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 w-8"><input type="checkbox" ref={el => { if (el) el.indeterminate = selectedIds.length > 0 && selectedIds.length < entries.length; }} checked={entries.length > 0 && selectedIds.length === entries.length} onChange={e => setSelectedIds(e.target.checked ? entries.map(x => x.id) : [])} /></th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">الرقم</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">التاريخ</th>
                <th className="px-4 py-3 text-right text-xs text-gray-500">البيان</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">المبلغ</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">بواسطة</th>
                <th className="px-4 py-3 text-center text-xs text-gray-500">إجراء</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className={`border-t border-gray-100 hover:bg-gray-50/50 cursor-pointer ${selectedIds.includes(e.id) ? 'bg-[#c9a84c]/5' : ''}`} onClick={() => openView(e.id)}>
                  <td className="px-3 py-3" onClick={ev => ev.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={ev => setSelectedIds(ev.target.checked ? [...selectedIds, e.id] : selectedIds.filter(id => id !== e.id))} /></td>
                  <td className="px-4 py-3 font-mono text-xs font-bold">{e.entry_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtDate(e.entry_date)}</td>
                  <td className="px-4 py-3 font-bold text-[#1a1a2e] truncate max-w-[200px]">{e.description || '—'}</td>
                  <td className="px-4 py-3 text-center font-mono font-bold text-[#c9a84c]">{Math.round(e.total_debit || 0).toLocaleString('ar-EG')} ج</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${STATUS_MAP[e.status]?.color}`}>{STATUS_MAP[e.status]?.label}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">{e.created_by_name}</td>
                  <td className="px-4 py-3 text-center" onClick={ev => ev.stopPropagation()}>
                    <Tooltip content="عرض"><button onClick={() => openView(e.id)} className="text-gray-400 hover:text-[#c9a84c]"><Eye size={14} /></button></Tooltip>
                    {e.status === 'draft' && <Tooltip content="ترحيل"><button onClick={() => handlePost(e.id)} className="text-gray-400 hover:text-green-600 mr-2"><CheckCircle size={14} /></button></Tooltip>}
                  </td>
                </tr>
              ))}
              {entries.length === 0 && <tr><td colSpan={8} className="text-center py-12 text-gray-400">لا توجد قيود</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
