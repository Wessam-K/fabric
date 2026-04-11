import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, Building2, Landmark, BadgeDollarSign, CheckCircle, AlertTriangle } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useToast } from '../components/Toast';
import { exportToExcel } from '../utils/exportExcel';

export default function BalanceSheet() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const { data: d } = await api.get('/accounting/balance-sheet', { params: { date: asOf } });
      setData(d);
    } catch { toast.error('فشل تحميل الميزانية العمومية'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [asOf]);

  const fmt = (n) => (n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const handleExport = () => {
    if (!data) return;
    const rows = [];
    rows.push({ الحساب: '═══ الأصول ═══', الكود: '', المبلغ: '' });
    data.assets.accounts.forEach(a => rows.push({ الكود: a.code, الحساب: a.name_ar, المبلغ: a.total_debit - a.total_credit }));
    rows.push({ الكود: '', الحساب: 'إجمالي الأصول', المبلغ: data.assets.total });
    rows.push({ الكود: '', الحساب: '', المبلغ: '' });
    rows.push({ الحساب: '═══ الخصوم ═══', الكود: '', المبلغ: '' });
    data.liabilities.accounts.forEach(a => rows.push({ الكود: a.code, الحساب: a.name_ar, المبلغ: a.total_credit - a.total_debit }));
    rows.push({ الكود: '', الحساب: 'إجمالي الخصوم', المبلغ: data.liabilities.total });
    rows.push({ الكود: '', الحساب: '', المبلغ: '' });
    rows.push({ الحساب: '═══ حقوق الملكية ═══', الكود: '', المبلغ: '' });
    data.equity.accounts.forEach(a => rows.push({ الكود: a.code, الحساب: a.name_ar, المبلغ: a.total_credit - a.total_debit }));
    rows.push({ الكود: '', الحساب: 'الأرباح المحتجزة', المبلغ: data.equity.retained_earnings });
    rows.push({ الكود: '', الحساب: 'إجمالي حقوق الملكية', المبلغ: data.equity.total + data.equity.retained_earnings });
    rows.push({ الكود: '', الحساب: '', المبلغ: '' });
    rows.push({ الكود: '', الحساب: 'إجمالي الخصوم وحقوق الملكية', المبلغ: data.total_liabilities_equity });
    exportToExcel(rows, `الميزانية العمومية ${asOf}`);
  };

  const AccountSection = ({ title, icon: Icon, accounts, total, colorClass, inverse, extraRow }) => (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={colorClass} />
          <h3 className="font-bold text-[#1a1a2e]">{title}</h3>
        </div>
        <span className={`text-lg font-bold font-mono ${colorClass}`}>{fmt(total)} ج.م</span>
      </div>
      {accounts.length > 0 || extraRow ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-2 text-right text-xs text-gray-500">الكود</th>
              <th className="px-6 py-2 text-right text-xs text-gray-500">الحساب</th>
              <th className="px-6 py-2 text-left text-xs text-gray-500">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-6 py-2 font-mono text-xs font-bold text-gray-500">{a.code}</td>
                <td className="px-6 py-2 text-[#1a1a2e]">{a.name_ar}</td>
                <td className="px-6 py-2 font-mono text-left">{fmt(inverse ? (a.total_credit - a.total_debit) : (a.total_debit - a.total_credit))}</td>
              </tr>
            ))}
            {extraRow && (
              <tr className="border-t border-gray-100 bg-yellow-50/50">
                <td className="px-6 py-2"></td>
                <td className="px-6 py-2 text-[#1a1a2e] italic">{extraRow.label}</td>
                <td className="px-6 py-2 font-mono text-left">{fmt(extraRow.value)}</td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 font-bold">
            <tr>
              <td className="px-6 py-2"></td>
              <td className="px-6 py-2">الإجمالي</td>
              <td className="px-6 py-2 font-mono text-left">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      ) : (
        <p className="px-6 py-4 text-gray-400 text-sm">لا توجد أرصدة</p>
      )}
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="الميزانية العمومية" subtitle="التقارير المالية" action={<HelpButton pageKey="balance-sheet" />} />

      <div className="flex gap-3 flex-wrap items-center mb-6">
        <div className="flex gap-2 items-center">
          <Calendar size={14} className="text-gray-400" />
          <span className="text-xs text-gray-500">كما في تاريخ:</span>
          <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)} className="form-input text-xs" />
          <button onClick={load} className="btn btn-ghost text-xs" title="تحديث"><RefreshCw size={12} /></button>
        </div>
        <div className="flex-1" />
        <button onClick={handleExport} className="btn btn-ghost text-xs" disabled={!data}><Download size={14} /> تصدير Excel</button>
      </div>

      {loading ? <LoadingState /> : data && (
        <div className="space-y-4">
          {/* Balance Check */}
          <div className={`rounded-2xl p-4 flex items-center gap-3 ${data.balanced ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {data.balanced ? <CheckCircle size={20} className="text-green-600" /> : <AlertTriangle size={20} className="text-red-600" />}
            <span className={`text-sm font-bold ${data.balanced ? 'text-green-700' : 'text-red-700'}`}>
              {data.balanced ? 'الميزانية متوازنة ✓' : 'تحذير: الميزانية غير متوازنة!'}
            </span>
            <div className="flex-1" />
            <div className="grid grid-cols-2 gap-6 text-sm">
              <div>
                <span className="text-xs text-gray-500">إجمالي الأصول: </span>
                <span className="font-mono font-bold text-blue-600">{fmt(data.assets.total)}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500">الخصوم + حقوق الملكية: </span>
                <span className="font-mono font-bold text-purple-600">{fmt(data.total_liabilities_equity)}</span>
              </div>
            </div>
          </div>

          {/* Two-column layout: Assets | Liabilities + Equity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Assets */}
            <AccountSection
              title="الأصول"
              icon={Building2}
              accounts={data.assets.accounts}
              total={data.assets.total}
              colorClass="text-blue-600"
              inverse={false}
            />

            {/* Liabilities + Equity stacked */}
            <div className="space-y-4">
              <AccountSection
                title="الخصوم"
                icon={Landmark}
                accounts={data.liabilities.accounts}
                total={data.liabilities.total}
                colorClass="text-red-600"
                inverse={true}
              />
              <AccountSection
                title="حقوق الملكية"
                icon={BadgeDollarSign}
                accounts={data.equity.accounts}
                total={data.equity.total + data.equity.retained_earnings}
                colorClass="text-purple-600"
                inverse={true}
                extraRow={{ label: 'الأرباح المحتجزة', value: data.equity.retained_earnings }}
              />
            </div>
          </div>

          {/* Bottom totals */}
          <div className="bg-[#1a1a2e] text-white rounded-2xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400">إجمالي الأصول</p>
              <p className="text-2xl font-bold font-mono">{fmt(data.assets.total)} ج.م</p>
            </div>
            <div>
              <p className="text-[32px] font-bold text-gray-500">=</p>
            </div>
            <div>
              <p className="text-xs text-gray-400">الخصوم + حقوق الملكية</p>
              <p className="text-2xl font-bold font-mono">{fmt(data.total_liabilities_equity)} ج.م</p>
            </div>
          </div>

          <p className="text-[10px] text-gray-400 text-center">كما في تاريخ: {asOf} | يتم احتساب القيود المُرحّلة فقط</p>
        </div>
      )}
    </div>
  );
}
