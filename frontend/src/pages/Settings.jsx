import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Save, Plus, Factory, Building2, Cog, DollarSign, Shield, Bell, Lock } from 'lucide-react';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import api from '../utils/api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/ConfirmDialog';

const TABS = [
  { key: 'factory', label: 'إعدادات المصنع', icon: Building2 },
  { key: 'production', label: 'إعدادات الإنتاج', icon: Factory },
  { key: 'finance', label: 'إعدادات المالية', icon: DollarSign },
  { key: 'system', label: 'إعدادات النظام', icon: Cog },
  { key: 'security', label: 'الأمان', icon: Lock },
  { key: 'notifications', label: 'الإشعارات', icon: Bell },
  { key: 'permissions', label: 'الصلاحيات', icon: Shield },
];

const FACTORY_FIELDS = [
  { key: 'factory_name', label: 'اسم المصنع', type: 'text' },
  { key: 'factory_address', label: 'العنوان', type: 'text' },
  { key: 'factory_phone', label: 'رقم الهاتف', type: 'text' },
  { key: 'currency', label: 'العملة', type: 'text', placeholder: 'EGP' },
  { key: 'tax_rate', label: 'نسبة الضريبة %', type: 'number' },
];

const PRODUCTION_FIELDS = [
  { key: 'masnaiya_default', label: 'المصنعية الافتراضية (ج)', type: 'number' },
  { key: 'masrouf_default', label: 'المصروف الافتراضي (ج)', type: 'number' },
  { key: 'waste_pct_default', label: 'نسبة الهدر الافتراضية %', type: 'number' },
  { key: 'margin_default', label: 'هامش الربح الافتراضي %', type: 'number' },
  { key: 'working_hours_per_day', label: 'ساعات العمل اليومية', type: 'number' },
  { key: 'working_days_per_week', label: 'أيام العمل في الأسبوع', type: 'number' },
  { key: 'low_stock_threshold', label: 'حد التنبيه للمخزون المنخفض', type: 'number' },
  { key: 'maintenance_reminder_days', label: 'تنبيه الصيانة قبل (أيام)', type: 'number' },
];

const FINANCE_FIELDS = [
  { key: 'expense_approval_required', label: 'المصاريف تحتاج اعتماد؟', type: 'select', options: [['1', 'نعم'], ['0', 'لا']] },
  { key: 'expense_approval_limit', label: 'حد الاعتماد التلقائي (ج)', type: 'number', hint: 'مصاريف أقل من هذا المبلغ تُعتمد تلقائياً' },
  { key: 'invoice_prefix', label: 'بادئة الفواتير', type: 'text', placeholder: 'INV-' },
  { key: 'po_prefix', label: 'بادئة أوامر الشراء', type: 'text', placeholder: 'PO-' },
  { key: 'wo_prefix', label: 'بادئة أوامر التشغيل', type: 'text', placeholder: 'WO-' },
  { key: 'expense_prefix', label: 'بادئة المصاريف', type: 'text', placeholder: 'EXP-' },
  { key: 'mo_prefix', label: 'بادئة أوامر الصيانة', type: 'text', placeholder: 'MO-' },
];

const SYSTEM_FIELDS = [
  { key: 'session_timeout_minutes', label: 'مدة الجلسة (دقيقة)', type: 'number', placeholder: '1440' },
  { key: 'date_format', label: 'تنسيق التاريخ', type: 'select', options: [['DD/MM/YYYY', 'DD/MM/YYYY'], ['YYYY-MM-DD', 'YYYY-MM-DD']] },
  { key: 'backup_enabled', label: 'النسخ الاحتياطي', type: 'select', options: [['1', 'مفعّل'], ['0', 'معطّل']] },
  { key: 'backup_frequency', label: 'تكرار النسخ', type: 'select', options: [['daily', 'يومي'], ['weekly', 'أسبوعي'], ['monthly', 'شهري']] },
];

const SECURITY_FIELDS = [
  { key: 'jwt_expiry_hours', label: 'مدة صلاحية التوكن (ساعة)', type: 'number', placeholder: '24' },
  { key: 'max_login_attempts', label: 'الحد الأقصى لمحاولات الدخول', type: 'number', placeholder: '5' },
  { key: 'lockout_duration_minutes', label: 'مدة القفل (دقيقة)', type: 'number', placeholder: '15' },
  { key: 'password_min_length', label: 'الحد الأدنى لطول كلمة المرور', type: 'number', placeholder: '10' },
  { key: 'require_password_complexity', label: 'تعقيد كلمة المرور', type: 'select', options: [['1', 'مطلوب (حروف + أرقام + رموز)'], ['0', 'غير مطلوب']] },
];

const NOTIFICATION_FIELDS = [
  { key: 'low_stock_alert_enabled', label: 'تنبيه المخزون المنخفض', type: 'select', options: [['1', 'مفعّل'], ['0', 'معطّل']] },
  { key: 'invoice_overdue_reminder_days', label: 'تذكير الفواتير المتأخرة (أيام)', type: 'number', placeholder: '3' },
  { key: 'wo_completion_notify', label: 'إشعار إتمام أوامر الإنتاج', type: 'select', options: [['1', 'مفعّل'], ['0', 'معطّل']] },
  { key: 'maintenance_due_notify', label: 'إشعار صيانة الماكينات', type: 'select', options: [['1', 'مفعّل'], ['0', 'معطّل']] },
  { key: 'leave_request_notify', label: 'إشعار طلبات الإجازة', type: 'select', options: [['1', 'مفعّل'], ['0', 'معطّل']] },
  { key: 'payroll_ready_notify', label: 'إشعار جاهزية الرواتب', type: 'select', options: [['1', 'مفعّل'], ['0', 'معطّل']] },
];

export default function SettingsPage() {
  const toast = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [settings, setSettings] = useState({});
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newStage, setNewStage] = useState('');
  const [tab, setTab] = useState('factory');

  useEffect(() => {
    Promise.all([
      api.get('/settings'),
      api.get('/settings/stages'),
    ])
      .then(([settingsRes, stagesRes]) => {
        setSettings(settingsRes.data);
        setStages(stagesRes.data);
      })
      .catch(() => toast.error('فشل تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.put('/settings', settings);
      setSettings(data);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch { toast.error('فشل حفظ الإعدادات'); }
    finally { setSaving(false); }
  };

  const addStage = async () => {
    if (!newStage.trim()) return;
    try {
      await api.post('/settings/stages', { name: newStage.trim() });
      setNewStage('');
      const { data } = await api.get('/settings/stages');
      setStages(data);
      toast.success('تمت إضافة المرحلة');
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  

  const toggleStage = async (stage) => {
    try {
      await api.put(`/settings/stages/${stage.id}`, { is_default: stage.is_default ? 0 : 1 });
      const { data } = await api.get('/settings/stages');
      setStages(data);
    } catch (err) { toast.error(err.response?.data?.error || 'خطأ'); }
  };

  const updateStageColor = async (stage, color) => {
    try {
      await api.put(`/settings/stages/${stage.id}`, { color });
      const { data } = await api.get('/settings/stages');
      setStages(data);
    } catch { /* */ }
  };

  if (loading) {
    return <LoadingState />;
  }

  const renderField = (f) => (
    <div key={f.key}>
      <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
      {f.type === 'select' ? (
        <select value={settings[f.key] ?? ''} onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
          className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none">
          <option value="">— اختر —</option>
          {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      ) : (
        <input type={f.type} value={settings[f.key] ?? ''} placeholder={f.placeholder || ''}
          onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
          className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none" />
      )}
      {f.hint && <p className="text-xs text-gray-400 mt-1">{f.hint}</p>}
    </div>
  );

  return (
    <div className="page">
      {ConfirmDialog}
      <PageHeader title="الإعدادات" subtitle="إدارة إعدادات المصنع والنظام"
        action={<div className="flex gap-2">
          <HelpButton pageKey="settings" />
          <button onClick={handleSave} disabled={saving} className="btn btn-gold"><Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}</button>
        </div>} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${tab === t.key ? 'bg-white text-[#1a1a2e] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Factory */}
      {tab === 'factory' && (
        <div className="card card-body space-y-5">
          <h3 className="section-title">معلومات المصنع</h3>
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
            بيانات المصنع الأساسية — تظهر في الفواتير والتقارير المطبوعة
          </div>
          {FACTORY_FIELDS.map(renderField)}
        </div>
      )}

      {/* Tab: Production */}
      {tab === 'production' && (
        <>
          <div className="card card-body space-y-5">
            <h3 className="section-title">القيم الافتراضية</h3>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              هذه القيم ستُطبَّق تلقائياً على كل موديل جديد
            </div>
            {PRODUCTION_FIELDS.map(renderField)}
          </div>

          {/* Production Stages */}
          <div className="card card-body space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Factory size={18} className="text-blue-600" />
              <h3 className="section-title">مراحل الإنتاج</h3>
              <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{stages.length}</span>
            </div>
            <p className="text-xs text-gray-400">تُستخدم في أوامر الإنتاج لتتبع تقدم كل أمر</p>

            <div className="space-y-2">
              {stages.map((stage, i) => (
                <div key={stage.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="text-xs text-gray-400 font-mono w-6">{i + 1}</span>
                  <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: stage.color || '#3b82f6' }} />
                  <input type="color" value={stage.color || '#3b82f6'} onChange={e => updateStageColor(stage, e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 p-0" title="تغيير اللون" />
                  <span className={`flex-1 text-sm font-bold ${stage.is_default ? 'text-[#1a1a2e]' : 'text-gray-400 line-through'}`}>{stage.name}</span>
                  <button onClick={() => toggleStage(stage)}
                    className={`text-[10px] px-2 py-1 rounded ${stage.is_default ? 'bg-green-50 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                    {stage.is_default ? 'مفعّل' : 'معطّل'}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <input type="text" value={newStage} onChange={e => setNewStage(e.target.value)}
                placeholder="اسم مرحلة جديدة..."
                onKeyDown={e => e.key === 'Enter' && addStage()}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:border-[#c9a84c] outline-none" />
              <button onClick={addStage}
                className="flex items-center gap-1 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold">
                <Plus size={14} /> إضافة
              </button>
            </div>
          </div>
        </>
      )}

      {/* Tab: Finance */}
      {tab === 'finance' && (
        <div className="card card-body space-y-5">
          <h3 className="section-title">الإعدادات المالية</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
            تحكم في بادئات الأرقام وإعدادات اعتماد المصاريف
          </div>
          {FINANCE_FIELDS.map(renderField)}
        </div>
      )}

      {/* Tab: System */}
      {tab === 'system' && (
        <div className="card card-body space-y-5">
          <h3 className="section-title">إعدادات النظام</h3>
          <div className="bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 text-sm text-purple-800">
            إعدادات الجلسة والنسخ الاحتياطي وتنسيق التاريخ
          </div>
          {SYSTEM_FIELDS.map(renderField)}
        </div>
      )}

      {/* Tab: Security */}
      {tab === 'security' && (
        <div className="card card-body space-y-5">
          <h3 className="section-title">إعدادات الأمان</h3>
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-800">
            تحكم في سياسات كلمات المرور ومدة الجلسات وحماية الحسابات
          </div>
          {SECURITY_FIELDS.map(renderField)}
        </div>
      )}

      {/* Tab: Notifications */}
      {tab === 'notifications' && (
        <div className="card card-body space-y-5">
          <h3 className="section-title">إعدادات الإشعارات</h3>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800">
            تفعيل أو تعطيل إشعارات النظام المختلفة
          </div>
          {NOTIFICATION_FIELDS.map(renderField)}
        </div>
      )}

      {/* Tab: Permissions */}
      {tab === 'permissions' && (
        <div className="card card-body space-y-4">
          <h3 className="section-title">الصلاحيات</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-700">
            لإدارة الصلاحيات بالتفصيل، انتقل إلى صفحة المستخدمين
          </div>
          <Link to="/users" className="inline-flex items-center gap-2 px-4 py-2 bg-[#1a1a2e] text-white rounded-lg text-sm font-bold hover:bg-[#2a2a3e] transition-colors">
            <Shield size={16} /> إدارة المستخدمين والصلاحيات
          </Link>
        </div>
      )}
    </div>
  );
}
