import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useToast } from '../components/Toast';
import { exportToExcel } from '../utils/exportExcel';

export default function IncomeStatement() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/accounting/income-statement', { params: { from, to } });
      setData(d);
    } catch { toast.error('فشل تحميل قائمة الدخل'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to]);

  const fmt = (n) => (n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleExport = () => {
    if (!data) return;
    const rows = [];
    rows.push({ الحساب: '═══ الإيرادات ═══', الكود: '', المبلغ: '' });
    data.revenue.accounts.forEach(a => rows.push({ الكود: a.code, الحساب: a.name_ar, المبلغ: a.total_credit - a.total_debit }));
    rows.push({ الكود: '', الحساب: 'إجمالي الإيرادات', المبلغ: data.revenue.total });
    rows.push({ الكود: '', الحساب: '', المبلغ: '' });
    rows.push({ الحساب: '═══ تكلفة المبيعات ═══', الكود: '', المبلغ: '' });
    data.cogs.accounts.forEach(a => rows.push({ الكود: a.code, الحساب: a.name_ar, المبلغ: a.total_debit - a.total_credit }));
    rows.push({ الكود: '', الحساب: 'إجمالي تكلفة المبيعات', المبلغ: data.cogs.total });
    rows.push({ الكود: '', الحساب: 'مجمل الربح', المبلغ: data.gross_profit });
    rows.push({ الكود: '', الحساب: '', المبلغ: '' });
    rows.push({ الحساب: '═══ مصروفات التشغيل ═══', الكود: '', المبلغ: '' });
    data.expenses.accounts.forEach(a => rows.push({ الكود: a.code, الحساب: a.name_ar, المبلغ: a.total_debit - a.total_credit }));
    rows.push({ الكود: '', الحساب: 'إجمالي مصروفات التشغيل', المبلغ: data.expenses.total });
    rows.push({ الكود: '', الحساب: '', المبلغ: '' });
    rows.push({ الكود: '', الحساب: '★ صافي الربح / (الخسارة)', المبلغ: data.net_profit });
    exportToExcel(rows, `قائمة الدخل ${from} - ${to}`);
  };

  const Section = ({ title, icon: Icon, accounts, total, totalLabel, colorClass, inverse }) => (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={colorClass} />
          <h3 className="font-bold text-[#1a1a2e]">{title}</h3>
        </div>
        <span className={`text-lg font-bold font-mono ${colorClass}`}>{fmt(total)} ج.م</span>
      </div>
      {accounts.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-2 text-right text-xs text-gray-500">الكود</th>
              <th className="px-6 py-2 text-right text-xs text-gray-500">الحساب</th>
              <th className="px-6 py-2 text-left text-xs text-gray-500">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-6 py-2 font-mono text-xs font-bold text-gray-500">{a.code}</td>
                <td className="px-6 py-2 text-[#1a1a2e]">{a.name_ar}</td>
                <td className="px-6 py-2 font-mono text-left">{fmt(inverse ? (a.total_debit - a.total_credit) : (a.total_credit - a.total_debit))}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-bold">
            <tr>
              <td className="px-6 py-2"></td>
              <td className="px-6 py-2">{totalLabel}</td>
              <td className="px-6 py-2 font-mono text-left">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="px-6 py-4 text-gray-400 text-sm">لا توجد حركات في هذه الفترة</p>
      )}
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="قائمة الدخل" subtitle="التقارير المالية" action={<HelpButton pageKey="income-statement" />} />

      <div className="flex gap-3 flex-wrap items-center mb-6">
        <div className="flex gap-2 items-center">
          <Calendar size={14} className="text-gray-400" />
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input text-xs" />
          <span className="text-gray-400 text-xs">إلى</span>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input text-xs" />
          <button onClick={load} className="btn btn-ghost text-xs" title="تحديث"><RefreshCw size={12} /></button>
        </div>
        <div className="flex-1" />
        <button onClick={handleExport} className="btn btn-ghost text-xs" disabled={!data}><Download size={14} /> تصدير Excel</button>
      </div>

      {loading ? <LoadingState /> : data && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400">إجمالي الإيرادات</p>
              <p className="text-xl font-bold font-mono text-green-600">{fmt(data.revenue.total)} ج.م</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400">تكلفة المبيعات</p>
              <p className="text-xl font-bold font-mono text-orange-600">{fmt(data.cogs.total)} ج.م</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400">مجمل الربح</p>
              <p className={`text-xl font-bold font-mono ${data.gross_profit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmt(data.gross_profit)} ج.م</p>
            </div>
            <div className={`rounded-2xl shadow-sm p-4 ${data.net_profit >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs text-gray-400">صافي الربح / (الخسارة)</p>
              <p className={`text-xl font-bold font-mono ${data.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(data.net_profit)} ج.م</p>
            </div>
          </div>

          {/* Profit Margin */}
          {data.revenue.total > 0 && (
            <div className="bg-white rounded-2xl shadow-sm p-4 flex items-center gap-4">
              <span className="text-xs text-gray-500">هامش الربح الإجمالي:</span>
              <span className="font-bold font-mono">{((data.gross_profit / data.revenue.total) * 100).toFixed(1)}%</span>
              <span className="text-xs text-gray-400 mx-2">|</span>
              <span className="text-xs text-gray-500">هامش صافي الربح:</span>
              <span className={`font-bold font-mono ${data.net_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>{((data.net_profit / data.revenue.total) * 100).toFixed(1)}%</span>
            </div>
          )}

          {/* Revenue Section */}
          <Section title="الإيرادات" icon={TrendingUp} accounts={data.revenue.accounts} total={data.revenue.total} totalLabel="إجمالي الإيرادات" colorClass="text-green-600" inverse={false} />

          {/* COGS Section */}
          <Section title="تكلفة المبيعات" icon={DollarSign} accounts={data.cogs.accounts} total={data.cogs.total} totalLabel="إجمالي تكلفة المبيعات" colorClass="text-orange-600" inverse={true} />

          {/* Gross Profit */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
            <span className="font-bold text-[#1a1a2e]">مجمل الربح</span>
            <span className={`text-xl font-bold font-mono ${data.gross_profit >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(data.gross_profit)} ج.م</span>
          </div>

          {/* Operating Expenses Section */}
          <Section title="مصروفات التشغيل" icon={TrendingDown} accounts={data.expenses.accounts} total={data.expenses.total} totalLabel="إجمالي المصروفات" colorClass="text-red-600" inverse={true} />

          {/* Net Profit */}
          <div className={`rounded-2xl p-6 flex items-center justify-between ${data.net_profit >= 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}>
            <span className="text-lg font-bold text-[#1a1a2e]">★ صافي الربح / (الخسارة)</span>
            <span className={`text-2xl font-bold font-mono ${data.net_profit >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(data.net_profit)} ج.م</span>
          </div>

          <p className="text-[10px] text-gray-400 text-center">الفترة: {from} — {to} | يتم احتساب القيود المُرحّلة فقط</p>
        </div>
      )}
    </div>
  );
}
