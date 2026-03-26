import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useToast } from '../components/Toast';

const TYPE_LABELS = { asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' };
const TYPE_COLORS = { asset: 'text-blue-600', liability: 'text-red-600', equity: 'text-purple-600', revenue: 'text-green-600', expense: 'text-orange-600' };

export default function TrialBalance() {
  const [data, setData] = useState(null);
  const [vatData, setVatData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [activeView, setActiveView] = useState('trial'); // trial | vat
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (from) params.from = from;
      if (to) params.to = to;
      const [tbRes, vatRes] = await Promise.all([
        api.get('/accounting/trial-balance', { params }),
        api.get('/accounting/vat-summary', { params }),
      ]);
      setData(tbRes.data);
      setVatData(vatRes.data);
    } catch { toast.error('فشل التحميل'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to]);

  const downloadCSV = (rows, filename) => {
    const headers = Object.keys(rows[0] || {});
    const safe = (v) => { const s = (v ?? '').toString().replace(/"/g, '""'); return /^[=+\-@\t\r]/.test(s) ? `"'${s}"` : `"${s}"`; };
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => headers.map(h => safe(r[h])).join(','))].join('\n');
    const a = document.createElement('a');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.href = url;
    a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (n) => Math.round(n || 0).toLocaleString('ar-EG');

  return (
    <div className="page">
      <PageHeader title="ميزان المراجعة والضريبة" subtitle="التقارير المالية" action={<HelpButton pageKey="trialbalance" />} />

      <div className="flex gap-3 flex-wrap items-center mb-6">
        <button onClick={() => setActiveView('trial')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'trial' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}>
          ميزان المراجعة
        </button>
        <button onClick={() => setActiveView('vat')} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeView === 'vat' ? 'bg-[#1a1a2e] text-white' : 'bg-gray-100 text-gray-600'}`}>
          ملخص ضريبة القيمة المضافة
        </button>
        <div className="flex-1" />
        <div className="flex gap-2 items-center">
          <Calendar size={14} className="text-gray-400" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input text-xs" />
          <span className="text-gray-400 text-xs">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input text-xs" />
          <button onClick={load} className="btn btn-ghost text-xs"><RefreshCw size={12} /></button>
        </div>
      </div>

      {loading ? <LoadingState /> : activeView === 'trial' ? (
        <div className="space-y-4">
          {data && (
            <>
              <div className="flex justify-between items-center">
                <div className="grid grid-cols-2 gap-4 flex-1 max-w-md">
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <p className="text-xs text-gray-400">إجمالي المدين</p>
                    <p className="text-xl font-bold font-mono text-blue-600">{fmt(data.totals.total_debit)} ج</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm p-4">
                    <p className="text-xs text-gray-400">إجمالي الدائن</p>
                    <p className="text-xl font-bold font-mono text-red-600">{fmt(data.totals.total_credit)} ج</p>
                  </div>
                </div>
                <button onClick={() => downloadCSV(data.accounts.map(a => ({ 'الكود': a.code, 'الحساب': a.name_ar, 'النوع': TYPE_LABELS[a.type], 'مدين': a.total_debit, 'دائن': a.total_credit, 'الرصيد': a.balance })), 'trial-balance')} className="btn btn-ghost text-xs">
                  <Download size={14} /> تصدير CSV
                </button>
              </div>

              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                      <th className="px-4 py-3 text-right text-xs text-gray-500">الحساب</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-500">النوع</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-500">مدين</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-500">دائن</th>
                      <th className="px-4 py-3 text-center text-xs text-gray-500">الرصيد</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.filter(a => a.total_debit || a.total_credit).map(a => (
                      <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-3 font-mono text-xs font-bold">{a.code}</td>
                        <td className="px-4 py-3 font-bold text-[#1a1a2e]">{a.name_ar}</td>
                        <td className="px-4 py-3 text-center"><span className={`text-[10px] font-bold ${TYPE_COLORS[a.type]}`}>{TYPE_LABELS[a.type]}</span></td>
                        <td className="px-4 py-3 text-center font-mono">{a.total_debit ? fmt(a.total_debit) : ''}</td>
                        <td className="px-4 py-3 text-center font-mono">{a.total_credit ? fmt(a.total_credit) : ''}</td>
                        <td className={`px-4 py-3 text-center font-mono font-bold ${a.balance >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(a.balance)} ج</td>
                      </tr>
                    ))}
                    {data.accounts.filter(a => a.total_debit || a.total_credit).length === 0 && (
                      <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                        <p className="mb-2">لا توجد حركات مالية مرحّلة</p>
                        <p className="text-[10px]">أنشئ قيود يومية من صفحة القيود ثم رحّلها لتظهر هنا</p>
                      </td></tr>
                    )}
                    <tr className="border-t-2 border-[#1a1a2e] font-bold bg-gray-50">
                      <td colSpan={3} className="px-4 py-3 text-left">الإجمالي</td>
                      <td className="px-4 py-3 text-center font-mono text-blue-600">{fmt(data.totals.total_debit)} ج</td>
                      <td className="px-4 py-3 text-center font-mono text-red-600">{fmt(data.totals.total_credit)} ج</td>
                      <td className={`px-4 py-3 text-center font-mono ${Math.abs(data.totals.total_debit - data.totals.total_credit) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                        {Math.abs(data.totals.total_debit - data.totals.total_credit) < 0.01 ? '✓ متوازن' : `فرق: ${fmt(data.totals.total_debit - data.totals.total_credit)} ج`}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {vatData && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <p className="text-xs text-gray-400 mb-1">ضريبة المبيعات</p>
                  <p className="text-2xl font-bold font-mono text-red-500">{fmt(vatData.sales_vat)} ج</p>
                  <p className="text-[10px] text-gray-300">من إجمالي مبيعات {fmt(vatData.sales_total)} ج</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-5">
                  <p className="text-xs text-gray-400 mb-1">ضريبة المشتريات</p>
                  <p className="text-2xl font-bold font-mono text-green-600">{fmt(vatData.purchase_vat)} ج</p>
                  <p className="text-[10px] text-gray-300">من إجمالي مشتريات {fmt(vatData.purchases_total)} ج</p>
                </div>
                <div className="bg-white rounded-2xl shadow-sm p-5 col-span-2 lg:col-span-1">
                  <p className="text-xs text-gray-400 mb-1">صافي الضريبة المستحقة</p>
                  <p className={`text-3xl font-bold font-mono ${vatData.net_vat >= 0 ? 'text-red-500' : 'text-green-600'}`}>
                    {fmt(vatData.net_vat)} ج
                  </p>
                  <p className="text-[10px] text-gray-300">{vatData.net_vat >= 0 ? 'مستحقة عليك' : 'لصالحك'}</p>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <p className="text-xs text-gray-400 mb-2">الفترة</p>
                <p className="text-sm text-gray-600">{vatData.period.from === 'all' ? 'كل الفترات' : `${vatData.period.from} — ${vatData.period.to}`}</p>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
