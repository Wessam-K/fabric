import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield, Check, X, Save, Search, Users, ChevronDown, ChevronLeft,
  Eye, RotateCcw, AlertTriangle, Copy, ChevronsUpDown, Filter,
  UserCog, Layers, Zap, EyeOff
} from 'lucide-react';
import { PageHeader, LoadingState, ConfirmDialog } from '../components/ui';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import HelpButton from '../components/HelpButton';

const ROLES = [
  { value: 'manager', label: 'مدير', icon: '👔', color: 'blue' },
  { value: 'accountant', label: 'محاسب', icon: '📊', color: 'emerald' },
  { value: 'production', label: 'إنتاج', icon: '🏭', color: 'violet' },
  { value: 'hr', label: 'موارد بشرية', icon: '👥', color: 'orange' },
  { value: 'viewer', label: 'مشاهد', icon: '👁️', color: 'gray' },
];

const ROLE_COLORS = {
  manager: { bg: 'bg-blue-50', bgStrong: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', ring: 'ring-blue-400', dot: 'bg-blue-500', gradient: 'from-blue-500 to-blue-600' },
  accountant: { bg: 'bg-emerald-50', bgStrong: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200', ring: 'ring-emerald-400', dot: 'bg-emerald-500', gradient: 'from-emerald-500 to-emerald-600' },
  production: { bg: 'bg-violet-50', bgStrong: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200', ring: 'ring-violet-400', dot: 'bg-violet-500', gradient: 'from-violet-500 to-violet-600' },
  hr: { bg: 'bg-orange-50', bgStrong: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', ring: 'ring-orange-400', dot: 'bg-orange-500', gradient: 'from-orange-500 to-orange-600' },
  viewer: { bg: 'bg-gray-50', bgStrong: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200', ring: 'ring-gray-400', dot: 'bg-gray-500', gradient: 'from-gray-500 to-gray-600' },
};

const MODULE_LABELS = {
  dashboard: 'لوحة التحكم', models: 'الموديلات', fabrics: 'الأقمشة', accessories: 'الاكسسوارات',
  work_orders: 'أوامر الإنتاج', invoices: 'الفواتير', suppliers: 'الموردين', purchase_orders: 'أوامر الشراء',
  inventory: 'المخزون', reports: 'التقارير', hr: 'الموارد البشرية', payroll: 'الرواتب',
  users: 'المستخدمين', audit: 'سجل المراجعة', settings: 'الإعدادات', machines: 'الماكينات',
  maintenance: 'الصيانة', expenses: 'المصروفات', accounting: 'المحاسبة', customers: 'العملاء',
  exports: 'التصدير العام', exports_customers: 'تصدير العملاء', exports_suppliers: 'تصدير الموردين',
  exports_fabrics: 'تصدير الأقمشة', exports_accessories: 'تصدير الاكسسوارات', exports_workorders: 'تصدير الإنتاج',
  exports_invoices: 'تصدير الفواتير', exports_purchaseorders: 'تصدير المشتريات', exports_hr: 'تصدير الموارد البشرية',
  exports_payroll: 'تصدير الرواتب', exports_accounting: 'تصدير المحاسبة', exports_reports: 'تصدير التقارير',
  exports_auditlog: 'تصدير المراجعة', sales_orders: 'أوامر البيع',
};

const MODULE_ICONS = {
  dashboard: '📊', models: '👗', fabrics: '🧵', accessories: '💎',
  work_orders: '🏭', invoices: '📄', suppliers: '🚛', purchase_orders: '🛒',
  inventory: '📦', reports: '📈', hr: '👥', payroll: '💰',
  users: '🛡️', audit: '📋', settings: '⚙️', machines: '⚡',
  maintenance: '🔧', expenses: '💸', accounting: '📒', customers: '🤝',
  exports: '📤', exports_customers: '📤', exports_suppliers: '📤',
  exports_fabrics: '📤', exports_accessories: '📤', exports_workorders: '📤',
  exports_invoices: '📤', exports_purchaseorders: '📤', exports_hr: '📤',
  exports_payroll: '📤', exports_accounting: '📤', exports_reports: '📤',
  exports_auditlog: '📤', sales_orders: '🛍️',
};

const ACTION_LABELS = { view: 'عرض', create: 'إنشاء', edit: 'تعديل', delete: 'حذف', export: 'تصدير', manage: 'إدارة', approve: 'موافقة', execute: 'تنفيذ', post: 'ترحيل' };

export default function Permissions() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('matrix');
  const [loading, setLoading] = useState(true);
  const [permDefs, setPermDefs] = useState([]);
  const [permGrouped, setPermGrouped] = useState({});
  const [rolePerms, setRolePerms] = useState({});
  const [editingRole, setEditingRole] = useState(null);
  const [editingPerms, setEditingPerms] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedModules, setExpandedModules] = useState({});
  const [permFilter, setPermFilter] = useState('all');
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userOverrides, setUserOverrides] = useState({});
  const [userDirty, setUserDirty] = useState(false);
  const [copyFromRole, setCopyFromRole] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(null);
  const [viewMode, setViewMode] = useState('cards');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [defRes, roleRes] = await Promise.all([
        api.get('/permissions/definitions'),
        api.get('/permissions/roles'),
      ]);
      setPermDefs(defRes.data.definitions);
      setPermGrouped(defRes.data.grouped);
      setRolePerms(roleRes.data);
      const expanded = {};
      Object.keys(defRes.data.grouped).forEach(m => { expanded[m] = true; });
      setExpandedModules(expanded);
    } catch { toast.error('فشل تحميل بيانات الصلاحيات'); }
    setLoading(false);
  }

  async function loadUsers() {
    try {
      const res = await api.get('/users');
      setUsers(res.data.filter(u => u.role !== 'superadmin'));
    } catch {}
  }

  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab]);

  const modules = useMemo(() => Object.keys(permGrouped), [permGrouped]);

  const filteredModules = useMemo(() => {
    let result = modules;
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(m =>
        (MODULE_LABELS[m] || m).toLowerCase().includes(s) ||
        (permGrouped[m] || []).some(d => (d.label_ar || '').includes(s) || (ACTION_LABELS[d.action] || d.action).includes(s))
      );
    }
    if (permFilter !== 'all' && editingPerms) {
      result = result.filter(m => {
        const actions = (permGrouped[m] || []);
        if (permFilter === 'enabled') return actions.some(d => editingPerms[`${d.module}:${d.action}`]);
        if (permFilter === 'disabled') return actions.some(d => !editingPerms[`${d.module}:${d.action}`]);
        return true;
      });
    }
    return result;
  }, [modules, search, permGrouped, permFilter, editingPerms]);

  const guardAction = useCallback((action) => {
    if (dirty || userDirty) {
      setConfirmLeave(() => action);
    } else {
      action();
    }
  }, [dirty, userDirty]);

  function applyPreset(type) {
    if (!editingPerms) return;
    const next = {};
    permDefs.forEach(d => {
      const key = `${d.module}:${d.action}`;
      if (type === 'full') next[key] = 1;
      else if (type === 'none') next[key] = 0;
      else if (type === 'view_only') next[key] = d.action === 'view' ? 1 : 0;
    });
    setEditingPerms(next);
    setDirty(true);
  }

  function toggleAllExpand() {
    const allExpanded = filteredModules.every(m => expandedModules[m]);
    const next = { ...expandedModules };
    filteredModules.forEach(m => { next[m] = !allExpanded; });
    setExpandedModules(next);
  }

  function startEdit(roleName) {
    const doEdit = () => {
      setEditingRole(roleName);
      setEditingPerms({ ...(rolePerms[roleName] || {}) });
      setDirty(false);
      setPermFilter('all');
    };
    if (editingRole === roleName && editingPerms) return;
    if (dirty) { guardAction(doEdit); } else { doEdit(); }
  }

  function cancelEdit() {
    setEditingRole(null);
    setEditingPerms(null);
    setDirty(false);
  }

  function togglePerm(key) {
    if (!editingPerms) return;
    setEditingPerms(prev => ({ ...prev, [key]: prev[key] ? 0 : 1 }));
    setDirty(true);
  }

  function toggleModule(mod) {
    if (!editingPerms) return;
    const actions = (permGrouped[mod] || []).map(d => `${d.module}:${d.action}`);
    const allOn = actions.every(k => editingPerms[k]);
    setEditingPerms(prev => {
      const next = { ...prev };
      actions.forEach(k => { next[k] = allOn ? 0 : 1; });
      return next;
    });
    setDirty(true);
  }

  function setAllPerms(value) {
    if (!editingPerms) return;
    const next = {};
    permDefs.forEach(d => { next[`${d.module}:${d.action}`] = value; });
    setEditingPerms(next);
    setDirty(true);
  }

  async function saveRolePerms() {
    if (!editingRole || !editingPerms) return;
    setSaving(true);
    try {
      await api.put(`/permissions/roles/${editingRole}`, { permissions: editingPerms });
      setRolePerms(prev => ({ ...prev, [editingRole]: { ...editingPerms } }));
      setDirty(false);
      setEditingRole(null);
      setEditingPerms(null);
      toast.success('تم حفظ صلاحيات الدور بنجاح');
    } catch (err) { toast.error(err.response?.data?.error || 'حدث خطأ'); }
    setSaving(false);
  }

  async function openUserOverrides(u) {
    setSelectedUser(u);
    try {
      const res = await api.get(`/permissions/user/${u.id}`);
      setUserOverrides(res.data);
    } catch { setUserOverrides({}); }
    setUserDirty(false);
  }

  function toggleUserOverride(key) {
    const roleDefault = rolePerms[selectedUser?.role]?.[key] || 0;
    setUserOverrides(prev => {
      const next = { ...prev };
      if (next[key] === undefined || next[key] === null) {
        next[key] = roleDefault ? 0 : 1;
      } else if (next[key] === roleDefault) {
        delete next[key];
      } else {
        next[key] = next[key] ? 0 : 1;
      }
      return next;
    });
    setUserDirty(true);
  }

  function clearUserOverride(key) {
    setUserOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
    setUserDirty(true);
  }

  function clearAllUserOverrides() {
    setUserOverrides({});
    setUserDirty(true);
  }

  async function saveUserOverrides() {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await api.put(`/permissions/user/${selectedUser.id}`, { permissions: userOverrides });
      setUserDirty(false);
      toast.success(`تم حفظ صلاحيات ${selectedUser.full_name} بنجاح`);
    } catch (err) { toast.error(err.response?.data?.error || 'حدث خطأ'); }
    setSaving(false);
  }

  function copyRolePerms(sourceRole) {
    if (!editingPerms || !sourceRole) return;
    const source = rolePerms[sourceRole] || {};
    setEditingPerms({ ...source });
    setDirty(true);
    setCopyFromRole('');
    toast.info(`تم نسخ صلاحيات ${ROLES.find(r => r.value === sourceRole)?.label || sourceRole}`);
  }

  function toggleModuleExpand(mod) {
    setExpandedModules(prev => ({ ...prev, [mod]: !prev[mod] }));
  }

  const overrideCount = Object.keys(userOverrides).length;
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (userRoleFilter && u.role !== userRoleFilter) return false;
      if (userSearch && !u.full_name?.includes(userSearch) && !u.username?.includes(userSearch)) return false;
      return true;
    });
  }, [users, userSearch, userRoleFilter]);

  // Count permissions per role
  const roleCounts = useMemo(() => {
    const counts = {};
    ROLES.forEach(r => {
      const perms = rolePerms[r.value] || {};
      counts[r.value] = Object.values(perms).filter(v => v).length;
    });
    return counts;
  }, [rolePerms]);

  return (
    <div className="page space-y-5">
      <PageHeader
        title="إدارة الصلاحيات"
        subtitle="تحكم كامل بصلاحيات الأدوار والمستخدمين"
        action={<HelpButton pageKey="permissions" />}
      />

      {/* Loading state */}
      {loading && <LoadingState message="جاري تحميل الصلاحيات..." />}

      {!loading && <>
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'matrix', label: 'مصفوفة الأدوار', icon: Shield, desc: 'صلاحيات كل دور' },
          { id: 'users', label: 'صلاحيات المستخدمين', icon: Users, desc: 'تخصيص لكل مستخدم' },
        ].map(t => (
          <button key={t.id} onClick={() => guardAction(() => { setTab(t.id); setEditingRole(null); setEditingPerms(null); setDirty(false); setSelectedUser(null); setUserDirty(false); })}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={16} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════ TAB: ROLE MATRIX ══════════ */}
      {tab === 'matrix' && (
        <div className="space-y-5">
          {/* Role cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {ROLES.map(r => {
              const c = ROLE_COLORS[r.value];
              const isEditing = editingRole === r.value;
              const total = permDefs.length;
              const active = roleCounts[r.value] || 0;
              const pct = total > 0 ? Math.round((active / total) * 100) : 0;
              const circumference = 2 * Math.PI * 20;
              const strokeDash = (pct / 100) * circumference;
              return (
                <button key={r.value} onClick={() => startEdit(r.value)}
                  className={`relative p-4 rounded-2xl border-2 transition-all text-right ${
                    isEditing
                      ? `${c.bg} ${c.border} ${c.text} shadow-lg ring-2 ${c.ring} scale-[1.02]`
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                  }`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{r.icon}</span>
                      <span className="font-bold text-sm">{r.label}</span>
                    </div>
                    {isEditing && <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold">{active}<span className="text-sm font-normal text-gray-400">/{total}</span></div>
                      <p className="text-xs text-gray-500 mt-0.5">{pct}% مفعّل</p>
                    </div>
                    <svg width="48" height="48" className="-rotate-90">
                      <circle cx="24" cy="24" r="20" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                      <circle cx="24" cy="24" r="20" fill="none" className={`stroke-current ${c.text}`} strokeWidth="3"
                        strokeDasharray={circumference} strokeDashoffset={circumference - strokeDash}
                        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
                    </svg>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Edit toolbar */}
          {editingRole && (
            <div className="bg-[#1a1a2e] text-white rounded-2xl p-4 flex items-center justify-between sticky top-14 z-20 shadow-lg flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg ${ROLE_COLORS[editingRole].bg} flex items-center justify-center`}>
                  <Shield size={16} className={ROLE_COLORS[editingRole].text} />
                </div>
                <div>
                  <p className="font-bold text-[#c9a84c]">تعديل صلاحيات: {ROLES.find(r => r.value === editingRole)?.label}</p>
                  <p className="text-xs text-gray-400">اضغط على أي صلاحية لتفعيلها أو تعطيلها</p>
                </div>
                {dirty && <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-1 rounded-lg animate-pulse">تغييرات غير محفوظة</span>}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Quick presets */}
                <div className="flex bg-white/10 rounded-lg overflow-hidden border border-white/20">
                  <button onClick={() => applyPreset('full')} title="تفعيل الكل"
                    className="px-2.5 py-1.5 text-xs hover:bg-emerald-600/50 transition-colors flex items-center gap-1">
                    <Zap size={11} /> الكل
                  </button>
                  <button onClick={() => applyPreset('view_only')} title="عرض فقط"
                    className="px-2.5 py-1.5 text-xs hover:bg-blue-600/50 transition-colors border-x border-white/20 flex items-center gap-1">
                    <Eye size={11} /> عرض فقط
                  </button>
                  <button onClick={() => applyPreset('none')} title="تعطيل الكل"
                    className="px-2.5 py-1.5 text-xs hover:bg-red-600/50 transition-colors flex items-center gap-1">
                    <EyeOff size={11} /> لا شيء
                  </button>
                </div>
                <div className="relative">
                  <select value={copyFromRole} onChange={e => { if (e.target.value) copyRolePerms(e.target.value); }}
                    className="px-3 py-1.5 text-xs bg-white/10 border border-white/20 rounded-lg text-white appearance-none cursor-pointer pr-7 pl-2">
                    <option value="" className="text-gray-900">نسخ من دور...</option>
                    {ROLES.filter(r => r.value !== editingRole).map(r => (
                      <option key={r.value} value={r.value} className="text-gray-900">{r.label}</option>
                    ))}
                  </select>
                  <Copy size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
                </div>
                <div className="w-px h-6 bg-white/20 mx-1" />
                <button onClick={cancelEdit} className="px-4 py-2 text-sm border border-white/20 rounded-xl hover:bg-white/10 transition-colors">إلغاء</button>
                <button onClick={saveRolePerms} disabled={saving || !dirty}
                  className="px-5 py-2 text-sm bg-[#c9a84c] text-[#1a1a2e] rounded-xl hover:bg-[#d4b55a] disabled:opacity-40 font-bold flex items-center gap-2 transition-colors">
                  {saving ? <span className="w-4 h-4 border-2 border-[#1a1a2e]/30 border-t-[#1a1a2e] rounded-full animate-spin" /> : <Save size={14} />}
                  حفظ
                </button>
              </div>
            </div>
          )}

          {/* Search & controls */}
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search size={16} className="absolute right-3 top-3 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="بحث في الوحدات والصلاحيات..."
                className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c] bg-white" />
            </div>
            {editingRole && (
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {[
                  { value: 'all', label: 'الكل' },
                  { value: 'enabled', label: 'مفعّل' },
                  { value: 'disabled', label: 'معطّل' },
                ].map(f => (
                  <button key={f.value} onClick={() => setPermFilter(f.value)}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${permFilter === f.value ? 'bg-white shadow-sm text-[#1a1a2e] font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={toggleAllExpand}
              className="flex items-center gap-1.5 px-3 py-2 text-xs text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              <ChevronsUpDown size={14} />
              {filteredModules.every(m => expandedModules[m]) ? 'طي الكل' : 'توسيع الكل'}
            </button>
          </div>

          {/* Permission modules */}
          <div className="space-y-3">
            {filteredModules.map(mod => {
              const actions = permGrouped[mod] || [];
              const expanded = expandedModules[mod];
              const permsForRole = editingPerms || rolePerms[editingRole || 'manager'] || {};
              const moduleAllOn = actions.every(d => permsForRole[`${d.module}:${d.action}`]);
              const moduleSomeOn = actions.some(d => permsForRole[`${d.module}:${d.action}`]);

              return (
                <div key={mod} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  {/* Module header */}
                  <button
                    onClick={() => toggleModuleExpand(mod)}
                    className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors"
                  >
                    <span className="text-lg">{MODULE_ICONS[mod] || '📁'}</span>
                    <span className="font-bold text-gray-900 flex-1 text-right">{MODULE_LABELS[mod] || mod}</span>
                    <span className="text-xs text-gray-400">{actions.length} صلاحية</span>

                    {/* Quick role overview dots */}
                    {!editingRole && (
                      <div className="flex gap-1.5 mx-2">
                        {ROLES.map(r => {
                          const rp = rolePerms[r.value] || {};
                          const count = actions.filter(d => rp[`${d.module}:${d.action}`]).length;
                          const all = count === actions.length;
                          const some = count > 0;
                          return (
                            <div key={r.value} title={`${r.label}: ${count}/${actions.length}`}
                              className={`w-2.5 h-2.5 rounded-full ${
                                all ? ROLE_COLORS[r.value].dot : some ? ROLE_COLORS[r.value].dot + ' opacity-30' : 'bg-gray-200'
                              }`} />
                          );
                        })}
                      </div>
                    )}

                    {/* Editing: module toggle */}
                    {editingRole && (
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleModule(mod); }}
                        className={`w-6 h-6 rounded-md flex items-center justify-center border text-xs transition-colors ${
                          moduleAllOn ? 'bg-emerald-500 border-emerald-500 text-white' :
                          moduleSomeOn ? 'bg-emerald-200 border-emerald-300 text-emerald-700' :
                          'bg-gray-100 border-gray-300'
                        } hover:ring-2 hover:ring-emerald-300`}>
                        {moduleAllOn && <Check size={13} />}
                        {moduleSomeOn && !moduleAllOn && <span>—</span>}
                      </button>
                    )}

                    <ChevronDown size={16} className={`text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Actions grid */}
                  {expanded && (
                    <div className="border-t border-gray-100 px-5 py-3">
                      {editingRole ? (
                        /* Single role edit mode */
                        <div className="flex gap-2 flex-wrap">
                          {actions.map(d => {
                            const key = `${d.module}:${d.action}`;
                            const on = !!(editingPerms || permsForRole)[key];
                            return (
                              <button key={key} onClick={() => togglePerm(key)}
                                className={`group px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                                  on
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                    : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-500'
                                }`}>
                                {on ? <Check size={13} className="inline ml-1.5 text-emerald-500" /> : <X size={13} className="inline ml-1.5 text-gray-300" />}
                                {d.label_ar || ACTION_LABELS[d.action] || d.action}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        /* Overview mode: show all roles in a table */
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr>
                                <th className="text-right pb-2 text-gray-500 font-medium text-xs pr-2">الصلاحية</th>
                                {ROLES.map(r => (
                                  <th key={r.value} className="pb-2 text-center">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs ${ROLE_COLORS[r.value].bg} ${ROLE_COLORS[r.value].text}`}>
                                      <span className={`w-1.5 h-1.5 rounded-full ${ROLE_COLORS[r.value].dot}`} />
                                      {r.label}
                                    </span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {actions.map(d => {
                                const key = `${d.module}:${d.action}`;
                                return (
                                  <tr key={key} className="border-t border-gray-50">
                                    <td className="py-2 pr-2 text-gray-700">{d.label_ar || ACTION_LABELS[d.action] || d.action}</td>
                                    {ROLES.map(r => {
                                      const on = !!(rolePerms[r.value] || {})[key];
                                      return (
                                        <td key={r.value} className="py-2 text-center">
                                          {on ? (
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-100">
                                              <Check size={13} className="text-emerald-600" />
                                            </span>
                                          ) : (
                                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100">
                                              <X size={13} className="text-gray-300" />
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══════════ TAB: USER OVERRIDES ══════════ */}
      {tab === 'users' && (
        <div className="space-y-5">
          {!selectedUser ? (
            <>
              {/* Info banner */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                <AlertTriangle size={18} className="text-amber-500 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-bold mb-1">صلاحيات خاصة بالمستخدمين</p>
                  <p className="text-amber-700">
                    الصلاحيات الخاصة تتجاوز صلاحيات الدور الأساسي. يمكنك منح صلاحية إضافية أو حجب صلاحية موجودة لمستخدم معين.
                  </p>
                </div>
              </div>

              {/* User search & role filter */}
              <div className="flex gap-3 items-center flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={16} className="absolute right-3 top-3 text-gray-400" />
                  <input value={userSearch} onChange={e => setUserSearch(e.target.value)}
                    placeholder="بحث بالاسم أو اسم المستخدم..."
                    className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c] bg-white" />
                </div>
                <div className="flex bg-gray-100 rounded-lg p-0.5">
                  <button onClick={() => setUserRoleFilter('')}
                    className={`px-3 py-1.5 text-xs rounded-md transition-colors ${!userRoleFilter ? 'bg-white shadow-sm text-[#1a1a2e] font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                    الكل
                  </button>
                  {ROLES.map(r => (
                    <button key={r.value} onClick={() => setUserRoleFilter(r.value)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-colors flex items-center gap-1 ${userRoleFilter === r.value ? 'bg-white shadow-sm text-[#1a1a2e] font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
                      <span className="text-xs">{r.icon}</span> {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Users grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredUsers.map(u => {
                  const rc = ROLE_COLORS[u.role] || ROLE_COLORS.viewer;
                  return (
                    <button key={u.id} onClick={() => openUserOverrides(u)}
                      className="bg-white rounded-2xl border border-gray-200 p-4 text-right hover:border-[#c9a84c]/50 hover:shadow-md transition-all group">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-[#1a1a2e] flex items-center justify-center text-[#c9a84c] font-bold text-lg shrink-0">
                          {u.full_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-gray-900 truncate">{u.full_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{u.username}</p>
                        </div>
                        <ChevronLeft size={16} className="text-gray-300 group-hover:text-[#c9a84c] transition-colors" />
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ${rc.bg} ${rc.text} border ${rc.border}`}>
                          {ROLES.find(r => r.value === u.role)?.label || u.role}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                          {u.status === 'active' ? 'نشط' : 'معطل'}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <div className="col-span-full text-center py-12 text-gray-400">لا يوجد مستخدمين</div>
                )}
              </div>
            </>
          ) : (
            /* User override editor */
            <>
              {/* Header */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="px-5 py-4 bg-gradient-to-l from-[#1a1a2e]/5 to-transparent border-b border-gray-200">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => guardAction(() => { setSelectedUser(null); setUserDirty(false); })}
                        className="text-gray-400 hover:text-gray-600 p-1.5 hover:bg-gray-100 rounded-lg">
                        <ChevronLeft size={18} className="rotate-180" />
                      </button>
                      <div className="w-11 h-11 rounded-xl bg-[#1a1a2e] flex items-center justify-center text-[#c9a84c] font-bold text-lg">
                        {selectedUser.full_name?.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{selectedUser.full_name}</h3>
                        <p className="text-xs text-gray-500">
                          الدور: <span className={`px-2 py-0.5 rounded text-xs ${ROLE_COLORS[selectedUser.role]?.bg} ${ROLE_COLORS[selectedUser.role]?.text}`}>
                            {ROLES.find(r => r.value === selectedUser.role)?.label}
                          </span>
                          {overrideCount > 0 && (
                            <span className="mr-2 text-amber-600 font-semibold">{overrideCount} تجاوز نشط</span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {overrideCount > 0 && (
                        <button onClick={clearAllUserOverrides} className="px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 flex items-center gap-1.5">
                          <RotateCcw size={13} /> مسح الكل
                        </button>
                      )}
                      <button onClick={() => guardAction(() => { setSelectedUser(null); setUserDirty(false); })}
                        className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">إلغاء</button>
                      <button onClick={saveUserOverrides} disabled={saving || !userDirty}
                        className="px-5 py-2 text-sm bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f] disabled:opacity-40 font-bold flex items-center gap-2">
                        {saving ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                        حفظ
                      </button>
                    </div>
                  </div>
                </div>

                {/* Legend */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-4 text-xs flex-wrap">
                  <Eye size={13} className="text-gray-400" />
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300 inline-block" /> مسموح من الدور</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 ring-1 ring-blue-200 inline-block" /> تجاوز: مسموح</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 ring-1 ring-red-200 inline-block" /> تجاوز: محجوب</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" /> غير مسموح</span>
                </div>

                {/* Permission grid */}
                <div className="divide-y divide-gray-100">
                  {modules.map(mod => {
                    const actions = permGrouped[mod] || [];
                    const roleDefault = rolePerms[selectedUser.role] || {};
                    return (
                      <div key={mod} className="hover:bg-gray-50/30">
                        <div className="flex items-center gap-3 px-5 py-3">
                          <span className="text-base">{MODULE_ICONS[mod] || '📁'}</span>
                          <span className="font-semibold text-gray-800 min-w-[130px]">{MODULE_LABELS[mod] || mod}</span>
                          <div className="flex gap-2 flex-wrap flex-1">
                            {actions.map(d => {
                              const key = `${d.module}:${d.action}`;
                              const hasOverride = userOverrides[key] !== undefined && userOverrides[key] !== null;
                              const roleVal = !!roleDefault[key];
                              const effectiveVal = hasOverride ? !!userOverrides[key] : roleVal;

                              let cls;
                              if (hasOverride && userOverrides[key]) {
                                cls = 'bg-blue-50 text-blue-700 border-blue-300 ring-1 ring-blue-200';
                              } else if (hasOverride && !userOverrides[key]) {
                                cls = 'bg-red-50 text-red-600 border-red-300 ring-1 ring-red-200';
                              } else if (roleVal) {
                                cls = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                              } else {
                                cls = 'bg-gray-50 text-gray-400 border-gray-200';
                              }

                              return (
                                <div key={key} className="relative group">
                                  <button onClick={() => toggleUserOverride(key)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium border-2 transition-all cursor-pointer hover:shadow-sm ${cls}`}>
                                    {effectiveVal ? <Check size={11} className="inline ml-1" /> : <X size={11} className="inline ml-1 opacity-40" />}
                                    {d.label_ar || ACTION_LABELS[d.action] || d.action}
                                  </button>
                                  {hasOverride && (
                                    <button onClick={(e) => { e.stopPropagation(); clearUserOverride(key); }}
                                      className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-gray-500 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                                      title="إزالة التجاوز">×</button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      </>}

      {/* Unsaved changes confirmation */}
      <ConfirmDialog
        open={!!confirmLeave}
        title="تغييرات غير محفوظة"
        message="لديك تغييرات غير محفوظة. هل تريد تجاهلها والمتابعة؟"
        danger
        onConfirm={() => {
          const action = confirmLeave;
          setConfirmLeave(null);
          setDirty(false);
          setUserDirty(false);
          if (action) action();
        }}
        onCancel={() => setConfirmLeave(null)}
      />
    </div>
  );
}
