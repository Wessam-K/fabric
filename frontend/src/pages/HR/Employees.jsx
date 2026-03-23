import { useState, useEffect } from 'react';
import { Plus, Search, Edit2, X, Trash2, Download } from 'lucide-react';
import { PageHeader } from '../../components/ui';
import HelpButton from '../../components/HelpButton';
import PermissionGuard from '../../components/PermissionGuard';
import api from '../../utils/api';
import { exportToExcel } from '../../utils/exportExcel';
import { useConfirm } from '../../components/ConfirmDialog';

const DEPARTMENTS = ['الإنتاج', 'المخازن', 'المحاسبة', 'الإدارة', 'الموارد البشرية'];
const EMP_TYPES = { full_time: 'دوام كامل', part_time: 'دوام جزئي', daily: 'يومي', piece_work: 'بالقطعة' };
const SALARY_TYPES = { monthly: 'شهري', daily: 'يومي', hourly: 'بالساعة', piece_work: 'بالقطعة' };
const TABS = ['البيانات الأساسية', 'الراتب والمزايا', 'الخصومات الثابتة', 'الحساب المصرفي'];

export default function Employees() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [employees, setEmployees] = useState([]);
  const [kpi, setKpi] = useState({});
  const [search, setSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterType, setFilterType] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [editEmp, setEditEmp] = useState(null);
  const [tab, setTab] = useState(0);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');

  useEffect(() => { load(); }, [search, filterDept, filterType]);

  function load() {
    const params = {};
    if (search) params.search = search;
    if (filterDept) params.department = filterDept;
    if (filterType) params.employment_type = filterType;
    api.get('/hr/employees', { params }).then(r => {
      setEmployees(r.data.employees);
      setKpi(r.data.kpi);
    }).catch(() => {});
  }

  async function openCreate() {
    setEditEmp(null); setTab(0); setError('');
    try {
      const r = await api.get('/hr/employees/next-code');
      setForm({ emp_code: r.data.next_code, full_name: '', national_id: '', department: '', job_title: '', employment_type: 'full_time',
        salary_type: 'monthly', base_salary: 0, standard_hours_per_day: 8, standard_days_per_month: 26,
        housing_allowance: 0, transport_allowance: 0, food_allowance: 0, other_allowances: 0,
        social_insurance: 0, tax_deduction: 0, other_deductions_fixed: 0, overtime_rate_multiplier: 1.5,
        hire_date: '', phone: '', address: '', bank_account: '', notes: '' });
    } catch { setForm({ emp_code: '' }); }
    setShowDrawer(true);
  }

  function openEdit(emp) {
    setEditEmp(emp); setTab(0); setError('');
    setForm({ ...emp });
    setShowDrawer(true);
  }

  async function handleSave() {
    setError('');
    try {
      if (editEmp) {
        await api.put(`/hr/employees/${editEmp.id}`, form);
      } else {
        await api.post('/hr/employees', form);
      }
      setShowDrawer(false);
      load();
    } catch (err) { setError(err.response?.data?.error || 'حدث خطأ'); }
  }

  async function handleDelete(emp) {
    const ok = await confirm({ title: 'إنهاء الخدمة', message: `إنهاء خدمة ${emp.full_name}؟` });
    if (!ok) return;
    try { await api.delete(`/hr/employees/${emp.id}`); load(); } catch (err) { alert(err.response?.data?.error || 'حدث خطأ'); }
  }

  function handleExport() {
    exportToExcel(employees, [
      { key: 'emp_code', header: 'الكود', width: 10 },
      { key: 'full_name', header: 'الاسم', width: 25 },
      { key: 'department', header: 'القسم', width: 15 },
      { key: 'job_title', header: 'المسمى', width: 15 },
      { key: 'salary_type', header: 'نوع الراتب', width: 10 },
      { key: 'base_salary', header: 'الراتب الأساسي', width: 15 },
      { key: 'status', header: 'الحالة', width: 10 },
    ], 'الموظفون');
  }

  const F = (key, val) => setForm({ ...form, [key]: val });

  return (
    <div className="page">
      {ConfirmDialog}
      <PageHeader title="الموظفون" subtitle="إدارة بيانات الموظفين"
        action={<div className="flex gap-2">
          <HelpButton pageKey="hr" />
          <button onClick={handleExport} className="btn btn-outline"><Download size={16} /> تصدير</button>
          <PermissionGuard module="hr" action="create">
            <button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> موظف جديد</button>
          </PermissionGuard>
        </div>} />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        {[{ l: 'إجمالي الموظفين', v: kpi.total, c: 'blue' }, { l: 'دوام كامل', v: kpi.full_time, c: 'green' }, { l: 'يومي', v: kpi.daily, c: 'orange' }, { l: 'بالقطعة', v: kpi.piece_work, c: 'purple' }].map((k, i) => (
          <div key={i} className={`bg-${k.c}-50 rounded-2xl p-4`}>
            <p className={`text-2xl font-bold text-${k.c}-600`}>{k.v || 0}</p>
            <p className="text-sm text-gray-600">{k.l}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-3 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الكود..."
            className="w-full pr-10 pl-4 py-2.5 border rounded-xl text-sm" />
        </div>
        <select value={filterDept} onChange={e => setFilterDept(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm">
          <option value="">جميع الأقسام</option>
          {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="px-3 py-2.5 border rounded-xl text-sm">
          <option value="">جميع الأنواع</option>
          {Object.entries(EMP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الكود</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الاسم</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">القسم</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">المسمى</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">نوع الراتب</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الراتب الأساسي</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">الحالة</th>
              <th className="px-4 py-3 text-right font-medium text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {employees.map(emp => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{emp.emp_code}</td>
                <td className="px-4 py-3 font-medium">{emp.full_name}</td>
                <td className="px-4 py-3 text-gray-600">{emp.department || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{emp.job_title || '—'}</td>
                <td className="px-4 py-3">{SALARY_TYPES[emp.salary_type] || emp.salary_type}</td>
                <td className="px-4 py-3 font-medium">{Number(emp.base_salary).toLocaleString('ar-EG')} ج</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${emp.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {emp.status === 'active' ? 'نشط' : 'منتهي'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(emp)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit2 size={14} /></button>
                    <button onClick={() => handleDelete(emp)} className="p-1.5 hover:bg-red-50 rounded-lg text-red-500"><Trash2 size={14} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {employees.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">لا يوجد موظفون</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowDrawer(false)} />
          <div className="relative mr-auto w-[500px] bg-white h-full shadow-xl overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{editEmp ? 'تعديل موظف' : 'موظف جديد'}</h2>
                <button onClick={() => setShowDrawer(false)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
              </div>

              {error && <div className="bg-red-50 text-red-600 px-4 py-2 rounded-xl text-sm">{error}</div>}

              {/* Tabs */}
              <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {TABS.map((t, i) => (
                  <button key={i} onClick={() => setTab(i)}
                    className={`flex-1 py-2 text-xs rounded-lg transition-colors ${tab === i ? 'bg-white shadow text-[#c9a84c] font-bold' : 'text-gray-500 hover:text-gray-700'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {tab === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">كود الموظف</label>
                      <input value={form.emp_code || ''} onChange={e => F('emp_code', e.target.value)} disabled={!!editEmp}
                        className="w-full px-3 py-2 border rounded-xl text-sm disabled:bg-gray-50" dir="ltr" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">الاسم الكامل</label>
                      <input value={form.full_name || ''} onChange={e => F('full_name', e.target.value)}
                        className="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">الرقم القومي</label>
                    <input value={form.national_id || ''} onChange={e => F('national_id', e.target.value)}
                      className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">القسم</label>
                      <select value={form.department || ''} onChange={e => F('department', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm">
                        <option value="">—</option>
                        {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">المسمى الوظيفي</label>
                      <input value={form.job_title || ''} onChange={e => F('job_title', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">نوع التوظيف</label>
                      <select value={form.employment_type || ''} onChange={e => F('employment_type', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm">
                        {Object.entries(EMP_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">تاريخ التعيين</label>
                      <input type="date" value={form.hire_date || ''} onChange={e => F('hire_date', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">الهاتف</label>
                      <input value={form.phone || ''} onChange={e => F('phone', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">العنوان</label>
                      <input value={form.address || ''} onChange={e => F('address', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" />
                    </div>
                  </div>
                </div>
              )}

              {tab === 1 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">نوع الراتب</label>
                      <select value={form.salary_type || ''} onChange={e => F('salary_type', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm">
                        {Object.entries(SALARY_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">الراتب الأساسي</label>
                      <input type="number" value={form.base_salary || 0} onChange={e => F('base_salary', Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium mb-1">ساعات العمل/يوم</label>
                      <input type="number" value={form.standard_hours_per_day || 8} onChange={e => F('standard_hours_per_day', Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">أيام العمل/شهر</label>
                      <input type="number" value={form.standard_days_per_month || 26} onChange={e => F('standard_days_per_month', Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-2">البدلات الشهرية</p>
                  <div className="grid grid-cols-2 gap-4">
                    {[['housing_allowance', 'بدل سكن'], ['transport_allowance', 'بدل مواصلات'], ['food_allowance', 'بدل طعام'], ['other_allowances', 'بدلات أخرى']].map(([k, l]) => (
                      <div key={k}>
                        <label className="block text-xs font-medium mb-1">{l}</label>
                        <input type="number" value={form[k] || 0} onChange={e => F(k, Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === 2 && (
                <div className="space-y-4">
                  {[['social_insurance', 'تأمينات اجتماعية'], ['tax_deduction', 'ضريبة'], ['other_deductions_fixed', 'خصومات أخرى ثابتة']].map(([k, l]) => (
                    <div key={k}>
                      <label className="block text-xs font-medium mb-1">{l}</label>
                      <input type="number" value={form[k] || 0} onChange={e => F(k, Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-medium mb-1">مضاعف الساعات الإضافية</label>
                    <input type="number" step="0.1" value={form.overtime_rate_multiplier || 1.5} onChange={e => F('overtime_rate_multiplier', Number(e.target.value))} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                  </div>
                </div>
              )}

              {tab === 3 && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium mb-1">رقم الحساب المصرفي</label>
                    <input value={form.bank_account || ''} onChange={e => F('bank_account', e.target.value)} className="w-full px-3 py-2 border rounded-xl text-sm" dir="ltr" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">ملاحظات</label>
                    <textarea value={form.notes || ''} onChange={e => F('notes', e.target.value)} rows={4} className="w-full px-3 py-2 border rounded-xl text-sm" />
                  </div>
                </div>
              )}

              <button onClick={handleSave} className="w-full py-2.5 bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f] font-medium">
                {editEmp ? 'حفظ التعديلات' : 'إنشاء الموظف'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
