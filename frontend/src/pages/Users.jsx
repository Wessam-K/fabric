import { useState, useEffect, useMemo } from 'react';
import { Shield, Plus, Search, Edit2, Key, X, UserX, ChevronDown, ChevronUp, Check, Lock, Unlock, Eye } from 'lucide-react';
import { PageHeader } from '../components/ui';
import api from '../utils/api';

const ROLES = [
  { value: 'superadmin', label: 'مدير النظام' },
  { value: 'manager', label: 'مدير' },
  { value: 'accountant', label: 'محاسب' },
  { value: 'production', label: 'إنتاج' },
  { value: 'hr', label: 'موارد بشرية' },
  { value: 'viewer', label: 'مشاهد' },
];

const ROLE_COLORS = {
  superadmin: 'bg-amber-100 text-amber-800 border-amber-200',
  manager: 'bg-blue-100 text-blue-800 border-blue-200',
  accountant: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  production: 'bg-violet-100 text-violet-800 border-violet-200',
  hr: 'bg-orange-100 text-orange-800 border-orange-200',
  viewer: 'bg-gray-100 text-gray-700 border-gray-200',
};

const MODULE_LABELS = {
  dashboard: 'لوحة التحكم', models: 'الموديلات', fabrics: 'الأقمشة', accessories: 'الاكسسوارات',
  work_orders: 'أوامر الإنتاج', invoices: 'الفواتير', suppliers: 'الموردين', purchase_orders: 'أوامر الشراء',
  inventory: 'المخزون', reports: 'التقارير', hr: 'الموارد البشرية', payroll: 'الرواتب',
  users: 'المستخدمين', audit: 'سجل المراجعة', settings: 'الإعدادات',
};

const ACTION_LABELS = { view: 'عرض', create: 'إنشاء', edit: 'تعديل', delete: 'حذف', export: 'تصدير', manage: 'إدارة' };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [showDrawer, setShowDrawer] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [form, setForm] = useState({ username: '', full_name: '', email: '', role: 'viewer', department: '', password: '' });
  const [resetPass, setResetPass] = useState({ show: false, userId: null, password: '' });
  const [error, setError] = useState('');
  const [tab, setTab] = useState('users'); // 'users' | 'roles' | 'user-perms'
  const [permDefs, setPermDefs] = useState([]);
  const [permGrouped, setPermGrouped] = useState({});
  const [rolePerms, setRolePerms] = useState({});
  const [selectedRole, setSelectedRole] = useState('manager');
  const [roleEditing, setRoleEditing] = useState(null); // role being edited (local copy)
  const [userPermsTarget, setUserPermsTarget] = useState(null); // user for override editor
  const [userOverrides, setUserOverrides] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); loadPermissions(); }, []);

  function load() {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }

  function loadPermissions() {
    api.get('/permissions/definitions').then(r => {
      setPermDefs(r.data.definitions);
      setPermGrouped(r.data.grouped);
    }).catch(() => {});
    api.get('/permissions/roles').then(r => setRolePerms(r.data)).catch(() => {});
  }

  function openCreate() {
    setEditUser(null);
    setForm({ username: '', full_name: '', email: '', role: 'viewer', department: '', password: '' });
    setError('');
    setShowDrawer(true);
  }

  function openEdit(u) {
    setEditUser(u);
    setForm({ username: u.username, full_name: u.full_name, email: u.email || '', role: u.role, department: u.department || '', password: '' });
    setError('');
    setShowDrawer(true);
  }

  async function handleSave() {
    setError('');
    try {
      if (editUser) {
        await api.put(`/users/${editUser.id}`, { full_name: form.full_name, email: form.email, role: form.role, department: form.department, status: form.status });
      } else {
        if (!form.password) return setError('كلمة المرور مطلوبة');
        await api.post('/users', form);
      }
      setShowDrawer(false);
      load();
    } catch (err) { setError(err.response?.data?.error || 'حدث خطأ'); }
  }

  async function handleResetPassword() {
    try {
      await api.patch(`/users/${resetPass.userId}/reset-password`, { new_password: resetPass.password });
      setResetPass({ show: false, userId: null, password: '' });
    } catch (err) { alert(err.response?.data?.error || 'حدث خطأ'); }
  }

  async function handleDeactivate(u) {
    if (!confirm(`تعطيل حساب ${u.full_name}?`)) return;
    try { await api.delete(`/users/${u.id}`); load(); } catch (err) { alert(err.response?.data?.error || 'حدث خطأ'); }
  }

  // Start editing role permissions
  function startRoleEdit(roleName) {
    setSelectedRole(roleName);
    setRoleEditing({ ...rolePerms[roleName] });
  }

  // Toggle a role permission
  function toggleRolePerm(key) {
    if (!roleEditing) return;
    setRoleEditing(prev => ({ ...prev, [key]: prev[key] ? 0 : 1 }));
  }

  // Toggle entire module for role
  function toggleRoleModule(mod) {
    if (!roleEditing) return;
    const actions = (permGrouped[mod] || []).map(d => `${d.module}:${d.action}`);
    const allOn = actions.every(k => roleEditing[k]);
    setRoleEditing(prev => {
      const next = { ...prev };
      actions.forEach(k => { next[k] = allOn ? 0 : 1; });
      return next;
    });
  }

  async function saveRolePerms() {
    if (!roleEditing) return;
    setSaving(true);
    try {
      await api.put(`/permissions/roles/${selectedRole}`, { permissions: roleEditing });
      setRolePerms(prev => ({ ...prev, [selectedRole]: roleEditing }));
      setRoleEditing(null);
    } catch (err) { alert(err.response?.data?.error || 'حدث خطأ'); }
    setSaving(false);
  }

  // Open user permission overrides
  async function openUserPerms(u) {
    setUserPermsTarget(u);
    try {
      const res = await api.get(`/permissions/user/${u.id}`);
      setUserOverrides(res.data);
    } catch { setUserOverrides({}); }
    setTab('user-perms');
  }

  function toggleUserOverride(key) {
    setUserOverrides(prev => {
      const next = { ...prev };
      if (next[key] === undefined || next[key] === null) {
        // First click: set to opposite of role default
        const roleDefault = rolePerms[userPermsTarget?.role]?.[key] || 0;
        next[key] = roleDefault ? 0 : 1;
      } else if (next[key] === (rolePerms[userPermsTarget?.role]?.[key] || 0)) {
        // Same as role default: remove override
        delete next[key];
      } else {
        // Toggle
        next[key] = next[key] ? 0 : 1;
      }
      return next;
    });
  }

  function clearUserOverride(key) {
    setUserOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function saveUserPerms() {
    if (!userPermsTarget) return;
    setSaving(true);
    try {
      await api.put(`/permissions/user/${userPermsTarget.id}`, { permissions: userOverrides });
      setUserPermsTarget(null);
      setTab('users');
    } catch (err) { alert(err.response?.data?.error || 'حدث خطأ'); }
    setSaving(false);
  }

  const filtered = users.filter(u => !search || u.full_name?.includes(search) || u.username?.includes(search));
  const active = users.filter(u => u.status === 'active').length;
  const inactive = users.filter(u => u.status !== 'active').length;
  const modules = Object.keys(permGrouped);

  return (
    <div className="page">
      {/* Header */}
      <PageHeader title="إدارة المستخدمين والصلاحيات" subtitle="إدارة الحسابات، الأدوار، ومصفوفة الصلاحيات"
        action={<button onClick={openCreate} className="btn btn-gold"><Plus size={16} /> مستخدم جديد</button>} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {[
          { id: 'users', label: 'المستخدمين', icon: Shield },
          { id: 'roles', label: 'صلاحيات الأدوار', icon: Lock },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === t.id ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon size={15} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ════════ TAB: USERS ════════ */}
      {tab === 'users' && (
        <div className="space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'إجمالي المستخدمين', val: users.length, bg: 'bg-gradient-to-br from-blue-50 to-blue-100', color: 'text-blue-700' },
              { label: 'نشط', val: active, bg: 'bg-gradient-to-br from-emerald-50 to-emerald-100', color: 'text-emerald-700' },
              { label: 'معطل', val: inactive, bg: 'bg-gradient-to-br from-red-50 to-red-100', color: 'text-red-600' },
            ].map((k, i) => (
              <div key={i} className={`${k.bg} rounded-2xl p-5 border border-white/50`}>
                <p className={`text-3xl font-bold ${k.color}`}>{k.val}</p>
                <p className="text-sm text-gray-600 mt-1">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute right-3 top-3 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو اسم المستخدم..."
              className="w-full pr-10 pl-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c] bg-white" />
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80">
                <tr>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">المستخدم</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">الدور</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">القسم</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">آخر دخول</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-700">الحالة</th>
                  <th className="px-4 py-3 text-center font-semibold text-gray-700">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#1a1a2e] flex items-center justify-center text-[#c9a84c] font-bold text-sm">
                          {u.full_name?.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{u.full_name}</p>
                          <p className="text-xs text-gray-400 font-mono">{u.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${ROLE_COLORS[u.role] || 'bg-gray-100'}`}>
                        {ROLES.find(r => r.value === u.role)?.label || u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.department || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{u.last_login ? new Date(u.last_login).toLocaleDateString('ar-EG') : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${u.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                        {u.status === 'active' ? 'نشط' : 'معطل'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(u)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="تعديل"><Edit2 size={14} className="text-gray-500" /></button>
                        <button onClick={() => openUserPerms(u)} className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors" title="صلاحيات خاصة"><Lock size={14} className="text-blue-500" /></button>
                        <button onClick={() => setResetPass({ show: true, userId: u.id, password: '' })} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" title="إعادة تعيين كلمة المرور"><Key size={14} className="text-gray-500" /></button>
                        <button onClick={() => handleDeactivate(u)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors" title="تعطيل"><UserX size={14} className="text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">لا يوجد مستخدمين</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ════════ TAB: ROLE PERMISSIONS ════════ */}
      {tab === 'roles' && (
        <div className="space-y-5">
          {/* Role selector */}
          <div className="flex gap-2 flex-wrap">
            {ROLES.filter(r => r.value !== 'superadmin').map(r => (
              <button key={r.value} onClick={() => startRoleEdit(r.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                  selectedRole === r.value
                    ? 'bg-[#1a1a2e] text-[#c9a84c] border-[#1a1a2e] shadow-md'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-[#c9a84c]/50'
                }`}>
                {r.label}
              </button>
            ))}
          </div>

          {/* Permission matrix */}
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">صلاحيات دور: {ROLES.find(r => r.value === selectedRole)?.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">اضغط على أي صلاحية لتفعيلها أو تعطيلها</p>
              </div>
              {roleEditing && (
                <div className="flex gap-2">
                  <button onClick={() => setRoleEditing(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">إلغاء</button>
                  <button onClick={saveRolePerms} disabled={saving}
                    className="px-5 py-2 text-sm bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f] disabled:opacity-50 flex items-center gap-2">
                    <Check size={14} /> حفظ التعديلات
                  </button>
                </div>
              )}
            </div>

            <div className="divide-y divide-gray-100">
              {modules.map(mod => {
                const actions = permGrouped[mod] || [];
                const perms = roleEditing || rolePerms[selectedRole] || {};
                const allOn = actions.every(d => perms[`${d.module}:${d.action}`]);
                const someOn = actions.some(d => perms[`${d.module}:${d.action}`]);
                return (
                  <div key={mod} className="hover:bg-gray-50/30">
                    <div className="flex items-center gap-4 px-5 py-3">
                      <button onClick={() => roleEditing && toggleRoleModule(mod)}
                        className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border text-xs transition-colors ${
                          allOn ? 'bg-emerald-500 border-emerald-500 text-white' :
                          someOn ? 'bg-emerald-200 border-emerald-300 text-emerald-700' :
                          'bg-gray-100 border-gray-300 text-gray-400'
                        } ${roleEditing ? 'cursor-pointer hover:border-emerald-400' : 'cursor-default'}`}>
                        {allOn && <Check size={12} />}
                        {someOn && !allOn && <span>—</span>}
                      </button>
                      <span className="font-semibold text-gray-800 min-w-[140px]">{MODULE_LABELS[mod] || mod}</span>
                      <div className="flex gap-2 flex-wrap flex-1">
                        {actions.map(d => {
                          const key = `${d.module}:${d.action}`;
                          const on = !!perms[key];
                          return (
                            <button key={key} onClick={() => roleEditing && toggleRolePerm(key)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                on ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                'bg-gray-50 text-gray-400 border-gray-200'
                              } ${roleEditing ? 'cursor-pointer hover:shadow-sm' : 'cursor-default'}`}>
                              {on ? <Check size={11} className="inline ml-1" /> : null}
                              {ACTION_LABELS[d.action] || d.action}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!roleEditing && (
              <div className="px-5 py-3 bg-gray-50/50 border-t">
                <button onClick={() => startRoleEdit(selectedRole)}
                  className="px-4 py-2 bg-[#1a1a2e] text-[#c9a84c] rounded-xl text-sm hover:bg-[#2a2a4e] transition-colors">
                  <Edit2 size={14} className="inline ml-2" />
                  تعديل صلاحيات هذا الدور
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════ TAB: USER PERMISSION OVERRIDES ════════ */}
      {tab === 'user-perms' && userPermsTarget && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setTab('users')} className="text-gray-400 hover:text-gray-600 text-sm">← العودة للمستخدمين</button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-4 bg-gradient-to-l from-[#1a1a2e]/5 to-transparent border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-[#1a1a2e] flex items-center justify-center text-[#c9a84c] font-bold">
                    {userPermsTarget.full_name?.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">صلاحيات خاصة: {userPermsTarget.full_name}</h3>
                    <p className="text-xs text-gray-500">
                      الدور الأساسي: <span className={`px-2 py-0.5 rounded text-xs ${ROLE_COLORS[userPermsTarget.role]}`}>{ROLES.find(r => r.value === userPermsTarget.role)?.label}</span>
                      <span className="mx-2 text-gray-300">|</span>
                      الصلاحيات المخصصة تتجاوز صلاحيات الدور
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setTab('users'); setUserPermsTarget(null); }} className="px-4 py-2 text-sm text-gray-600 border rounded-xl hover:bg-gray-50">إلغاء</button>
                  <button onClick={saveUserPerms} disabled={saving}
                    className="px-5 py-2 text-sm bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f] disabled:opacity-50">
                    <Check size={14} className="inline ml-1" /> حفظ
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-50 border-b border-amber-100 text-xs text-amber-700 flex items-center gap-2">
              <Eye size={14} />
              <span className="font-semibold">أخضر</span> = مسموح من الدور
              <span className="mx-1">|</span>
              <span className="font-semibold text-blue-600">أزرق</span> = تجاوز مخصص (مُضاف)
              <span className="mx-1">|</span>
              <span className="font-semibold text-red-600">أحمر</span> = تجاوز مخصص (محجوب)
              <span className="mx-1">|</span>
              <span className="font-semibold text-gray-500">رمادي</span> = غير مسموح
            </div>

            <div className="divide-y divide-gray-100">
              {modules.map(mod => {
                const actions = permGrouped[mod] || [];
                const roleDefault = rolePerms[userPermsTarget.role] || {};
                return (
                  <div key={mod} className="hover:bg-gray-50/30">
                    <div className="flex items-center gap-4 px-5 py-3">
                      <span className="font-semibold text-gray-800 min-w-[140px]">{MODULE_LABELS[mod] || mod}</span>
                      <div className="flex gap-2 flex-wrap flex-1">
                        {actions.map(d => {
                          const key = `${d.module}:${d.action}`;
                          const hasOverride = userOverrides[key] !== undefined && userOverrides[key] !== null;
                          const roleVal = !!roleDefault[key];
                          const effectiveVal = hasOverride ? !!userOverrides[key] : roleVal;

                          let cls = '';
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
                                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer hover:shadow-sm ${cls}`}>
                                {effectiveVal && <Check size={11} className="inline ml-1" />}
                                {ACTION_LABELS[d.action] || d.action}
                              </button>
                              {hasOverride && (
                                <button onClick={(e) => { e.stopPropagation(); clearUserOverride(key); }}
                                  className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-gray-400 text-white text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
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
        </div>
      )}

      {/* Create/Edit Drawer */}
      {showDrawer && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDrawer(false)} />
          <div className="relative mr-auto w-[440px] bg-white h-full shadow-2xl overflow-y-auto">
            <div className="p-6 space-y-5">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editUser ? 'تعديل المستخدم' : 'مستخدم جديد'}</h2>
                <button onClick={() => setShowDrawer(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X size={18} /></button>
              </div>

              {error && <div className="bg-red-50 text-red-600 px-4 py-2.5 rounded-xl text-sm border border-red-100">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">اسم المستخدم</label>
                <input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} disabled={!!editUser}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm disabled:bg-gray-50 focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الاسم الكامل</label>
                <input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">البريد الإلكتروني</label>
                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]" dir="ltr" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">الدور</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]">
                  {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">القسم</label>
                <input value={form.department} onChange={e => setForm({ ...form, department: e.target.value })}
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]" />
              </div>
              {!editUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">كلمة المرور</label>
                  <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]" dir="ltr" />
                </div>
              )}

              <button onClick={handleSave} className="w-full py-3 bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f] font-medium transition-colors shadow-sm">
                {editUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetPass.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-96 space-y-4 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">إعادة تعيين كلمة المرور</h3>
            <input type="password" placeholder="كلمة المرور الجديدة" value={resetPass.password}
              onChange={e => setResetPass({ ...resetPass, password: e.target.value })}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#c9a84c]/30 focus:border-[#c9a84c]" dir="ltr" />
            <div className="flex gap-2">
              <button onClick={handleResetPassword} className="flex-1 py-2.5 bg-[#c9a84c] text-white rounded-xl hover:bg-[#b8993f] font-medium">تأكيد</button>
              <button onClick={() => setResetPass({ show: false, userId: null, password: '' })} className="flex-1 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50 font-medium">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
