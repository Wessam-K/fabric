import { useState, useEffect } from 'react';
import { Calendar, Download, RefreshCw, ArrowUpCircle, ArrowDownCircle, Wallet, TrendingUp, Building2, Landmark } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useToast } from '../components/Toast';
import { exportToExcel } from '../utils/exportExcel';

export default function CashFlowStatement() {
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
      const { data: d } = await api.get('/accounting/cash-flow', { params: { from, to } });
      setData(d);
    } catch { toast.error('فشل تحميل قائمة التدفقات النقدية'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [from, to]);

  const fmt = (n) => (n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const signColor = (n) => n > 0 ? 'text-green-600' : n < 0 ? 'text-red-600' : 'text-gray-500';

  const handleExport = () => {
    if (!data) return;
    const rows = [];
    rows.push({ البند: 'صافي الدخل', المبلغ: data.net_income });
    rows.push({ البند: '', المبلغ: '' });
    rows.push({ البند: '═══ الأنشطة التشغيلية ═══', المبلغ: '' });
    rows.push({ البند: 'تغيرات رأس المال العامل:', المبلغ: '' });
    data.operating.working_capital_changes.forEach(a => rows.push({ البند: `  ${a.name_ar}`, المبلغ: a.change }));
    rows.push({ البند: 'صافي التدفق من الأنشطة التشغيلية', المبلغ: data.operating.total });
    rows.push({ البند: '', المبلغ: '' });
    rows.push({ البند: '═══ الأنشطة الاستثمارية ═══', المبلغ: '' });
    data.investing.accounts.forEach(a => rows.push({ البند: `  ${a.name_ar}`, المبلغ: -(a.total_debit - a.total_credit) }));
    rows.push({ البند: 'صافي التدفق من الأنشطة الاستثمارية', المبلغ: data.investing.total });
    rows.push({ البند: '', المبلغ: '' });
    rows.push({ البند: '═══ الأنشطة التمويلية ═══', المبلغ: '' });
    data.financing.accounts.forEach(a => rows.push({ البند: `  ${a.name_ar}`, المبلغ: a.total_credit - a.total_debit }));
    rows.push({ البند: 'صافي التدفق من الأنشطة التمويلية', المبلغ: data.financing.total });
    rows.push({ البند: '', المبلغ: '' });
    rows.push({ البند: '★ صافي التغير في النقدية', المبلغ: data.net_cash_change });
    exportToExcel(rows, `التدفقات النقدية ${from} - ${to}`);
  };

  const FlowSection = ({ title, icon: Icon, items, total, labelKey, valueKey, colorClass }) => (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={colorClass} />
          <h3 className="font-bold text-[#1a1a2e]">{title}</h3>
        </div>
        <span className={`text-lg font-bold font-mono ${signColor(total)}`}>{fmt(total)} ج.م</span>
      </div>
      {items.length > 0 ? (
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-2 text-right text-xs text-gray-500">الكود</th>
              <th className="px-6 py-2 text-right text-xs text-gray-500">البند</th>
              <th className="px-6 py-2 text-left text-xs text-gray-500">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={item.id || i} className="border-t border-gray-100 hover:bg-gray-50/50">
                <td className="px-6 py-2 font-mono text-xs font-bold text-gray-500">{item.code || ''}</td>
                <td className="px-6 py-2 text-[#1a1a2e]">{item[labelKey]}</td>
                <td className={`px-6 py-2 font-mono text-left ${signColor(item[valueKey])}`}>{fmt(item[valueKey])}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-50 font-bold">
            <tr>
              <td className="px-6 py-2"></td>
              <td className="px-6 py-2">الإجمالي</td>
              <td className={`px-6 py-2 font-mono text-left ${signColor(total)}`}>{fmt(total)}</td>
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
      <PageHeader title="قائمة التدفقات النقدية" subtitle="التقارير المالية — الطريقة غير المباشرة" action={<HelpButton pageKey="cash-flow" />} />

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
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400">صافي الدخل</p>
              <p className={`text-xl font-bold font-mono ${signColor(data.net_income)}`}>{fmt(data.net_income)} ج.م</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400">التدفق التشغيلي</p>
              <p className={`text-xl font-bold font-mono ${signColor(data.operating.total)}`}>{fmt(data.operating.total)} ج.م</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <p className="text-xs text-gray-400">التدفق الاستثماري</p>
              <p className={`text-xl font-bold font-mono ${signColor(data.investing.total)}`}>{fmt(data.investing.total)} ج.م</p>
            </div>
            <div className={`rounded-2xl shadow-sm p-4 ${data.net_cash_change >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="text-xs text-gray-400">صافي التغير في النقدية</p>
              <p className={`text-xl font-bold font-mono ${signColor(data.net_cash_change)}`}>{fmt(data.net_cash_change)} ج.م</p>
            </div>
          </div>

          {/* Net Income Starting Point */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp size={16} className="text-blue-600" />
              <span className="font-bold text-[#1a1a2e]">صافي الدخل (نقطة البداية)</span>
            </div>
            <span className={`text-xl font-bold font-mono ${signColor(data.net_income)}`}>{fmt(data.net_income)} ج.م</span>
          </div>

          {/* Operating Activities */}
          <FlowSection
            title="الأنشطة التشغيلية"
            icon={ArrowUpCircle}
            items={data.operating.working_capital_changes}
            total={data.operating.total}
            labelKey="name_ar"
            valueKey="change"
            colorClass="text-green-600"
          />

          {/* Investing Activities */}
          <FlowSection
            title="الأنشطة الاستثمارية"
            icon={Building2}
            items={data.investing.accounts.map(a => ({ ...a, amount: -(a.total_debit - a.total_credit) }))}
            total={data.investing.total}
            labelKey="name_ar"
            valueKey="amount"
            colorClass="text-orange-600"
          />

          {/* Financing Activities */}
          <FlowSection
            title="الأنشطة التمويلية"
            icon={Landmark}
            items={data.financing.accounts.map(a => ({ ...a, amount: a.total_credit - a.total_debit }))}
            total={data.financing.total}
            labelKey="name_ar"
            valueKey="amount"
            colorClass="text-purple-600"
          />

          {/* Net Cash Change */}
          <div className={`rounded-2xl p-6 flex items-center justify-between ${data.net_cash_change >= 0 ? 'bg-green-50 border-2 border-green-300' : 'bg-red-50 border-2 border-red-300'}`}>
            <div className="flex items-center gap-3">
              <Wallet size={24} className={signColor(data.net_cash_change)} />
              <span className="text-lg font-bold text-[#1a1a2e]">★ صافي التغير في النقدية</span>
            </div>
            <span className={`text-2xl font-bold font-mono ${signColor(data.net_cash_change)}`}>{fmt(data.net_cash_change)} ج.م</span>
          </div>

          {/* Cash Position */}
          {data.cash_accounts?.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="font-bold text-[#1a1a2e]">أرصدة الحسابات النقدية</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-2 text-right text-xs text-gray-500">الكود</th>
                    <th className="px-6 py-2 text-right text-xs text-gray-500">الحساب</th>
                    <th className="px-6 py-2 text-left text-xs text-gray-500">الحركة</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cash_accounts.map(a => (
                    <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                      <td className="px-6 py-2 font-mono text-xs font-bold text-gray-500">{a.code}</td>
                      <td className="px-6 py-2 text-[#1a1a2e]">{a.name_ar}</td>
                      <td className={`px-6 py-2 font-mono text-left ${signColor(a.total_debit - a.total_credit)}`}>{fmt(a.total_debit - a.total_credit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center">الفترة: {from} — {to} | الطريقة غير المباشرة | يتم احتساب القيود المُرحّلة فقط</p>
        </div>
      )}
    </div>
  );
}
