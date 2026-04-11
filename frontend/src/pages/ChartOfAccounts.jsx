import { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Save, X, BookOpen, Search, ChevronDown, ChevronLeft } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useToast } from '../components/Toast';

const TYPE_LABELS = { asset: 'أصول', liability: 'خصوم', equity: 'حقوق ملكية', revenue: 'إيرادات', expense: 'مصروفات' };
const TYPE_COLORS = { asset: 'bg-blue-100 text-blue-700', liability: 'bg-red-100 text-red-700', equity: 'bg-purple-100 text-purple-700', revenue: 'bg-green-100 text-green-700', expense: 'bg-orange-100 text-orange-700' };

export default function ChartOfAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ code: '', name_ar: '', type: 'asset', parent_id: '' });
  const [showNew, setShowNew] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState({});
  const toast = useToast();

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get('/accounting/coa'); setAccounts(data); }
    catch { toast.error('فشل تحميل الحسابات'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    try {
      if (editing) {
        await api.put(`/accounting/coa/${editing}`, form);
        toast.success('تم التحديث');
      } else {
        await api.post('/accounting/coa', form);
        toast.success('تم الإضافة');
      }
      setEditing(null); setShowNew(false);
      setForm({ code: '', name_ar: '', type: 'asset', parent_id: '' });
      load();
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const startEdit = (acc) => {
    setEditing(acc.id);
    setForm({ code: acc.code, name_ar: acc.name_ar, type: acc.type, parent_id: acc.parent_id || '' });
    setShowNew(false);
  };

  const cancel = () => { setEditing(null); setShowNew(false); setForm({ code: '', name_ar: '', type: 'asset', parent_id: '' }); };

  // Build tree: parent accounts first, then children indented
  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return accounts;
    const q = searchQuery.toLowerCase();
    return accounts.filter(a => a.code?.toLowerCase().includes(q) || a.name_ar?.toLowerCase().includes(q));
  }, [accounts, searchQuery]);

  const buildTree = (items, type) => {
    const typeItems = items.filter(a => a.type === type);
    const roots = typeItems.filter(a => !a.parent_id || !typeItems.some(p => p.id === a.parent_id));
    const children = typeItems.filter(a => a.parent_id && typeItems.some(p => p.id === a.parent_id));
    const result = [];
    for (const root of roots) {
      result.push({ ...root, depth: 0 });
      if (!collapsed[root.id]) {
        for (const child of children.filter(c => c.parent_id === root.id)) {
          result.push({ ...child, depth: 1 });
        }
      }
    }
    return result;
  };

  const toggleCollapse = (id) => setCollapsed(prev => ({ ...prev, [id]: !prev[id] }));
  const hasChildren = (id) => accounts.some(a => a.parent_id === id);

  return (
    <div className="page">
      <PageHeader title="دليل الحسابات" subtitle={`${accounts.length} حساب`}
        actions={<div className="flex items-center gap-2"><HelpButton pageKey="chartofaccounts" /><button onClick={() => { setShowNew(true); setEditing(null); setForm({ code: '', name_ar: '', type: 'asset', parent_id: '' }); }} className="btn btn-primary"><Plus size={14} /> حساب جديد</button></div>}
      />

      {(showNew || editing) && (
        <div className="bg-white rounded-2xl shadow-sm p-5 mb-6 space-y-4">
          <h3 className="font-bold text-[#1a1a2e]">{editing ? 'تعديل حساب' : 'حساب جديد'}</h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs text-gray-500">الكود</label>
              <input type="text" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} className="form-input w-full" placeholder="1000" />
            </div>
            <div>
              <label className="text-xs text-gray-500">الاسم</label>
              <input type="text" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} className="form-input w-full" placeholder="اسم الحساب" />
            </div>
            <div>
              <label className="text-xs text-gray-500">النوع</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="form-select w-full">
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">الحساب الأب</label>
              <select value={form.parent_id} onChange={e => setForm({ ...form, parent_id: e.target.value || null })} className="form-select w-full">
                <option value="">— لا يوجد —</option>
                {accounts.filter(a => a.id !== editing).map(a => <option key={a.id} value={a.id}>{a.code} — {a.name_ar}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="btn btn-primary"><Save size={14} /> حفظ</button>
            <button onClick={cancel} className="btn btn-ghost"><X size={14} /> إلغاء</button>
          </div>
        </div>
      )}

      {loading ? <LoadingState /> : (
        <div className="space-y-6">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="بحث بالكود أو الاسم..."
              className="form-input w-full pr-10" />
          </div>
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const treeItems = buildTree(filteredAccounts, type);
            if (!treeItems.length) return null;
            return (
              <div key={type}>
                <h3 className={`text-sm font-bold px-3 py-1 rounded-lg inline-block mb-3 ${TYPE_COLORS[type]}`}>
                  <BookOpen size={12} className="inline ml-1" />{label} ({treeItems.length})
                </h3>
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-right text-xs text-gray-500">الكود</th>
                        <th className="px-4 py-3 text-right text-xs text-gray-500">الاسم</th>
                        <th className="px-4 py-3 text-center text-xs text-gray-500">الحساب الأب</th>
                        <th className="px-4 py-3 text-center text-xs text-gray-500">الحالة</th>
                        <th className="px-4 py-3 text-center text-xs text-gray-500">إجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {treeItems.map(a => (
                        <tr key={a.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                          <td className="px-4 py-3 font-mono text-xs font-bold" style={{ paddingRight: `${16 + (a.depth || 0) * 24}px` }}>
                            {hasChildren(a.id) && (
                              <button onClick={() => toggleCollapse(a.id)} className="inline-flex ml-1 text-gray-400 hover:text-gray-600">
                                {collapsed[a.id] ? <ChevronLeft size={12} /> : <ChevronDown size={12} />}
                              </button>
                            )}
                            {a.code}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#1a1a2e]">{a.name_ar}</td>
                          <td className="px-4 py-3 text-center text-xs text-gray-400">{a.parent_name ? `${a.parent_code} — ${a.parent_name}` : '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full ${a.is_active ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                              {a.is_active ? 'نشط' : 'معطل'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button onClick={() => startEdit(a)} className="text-gray-400 hover:text-[#c9a84c]"><Edit2 size={14} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
