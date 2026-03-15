import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import axios from 'axios';
import { useToast } from '../components/Toast';

const FIELDS = [
  { key: 'masnaiya_default', label: 'المصنعية الافتراضية (ج)', type: 'number' },
  { key: 'masrouf_default', label: 'المصروف الافتراضي (ج)', type: 'number' },
  { key: 'waste_pct_default', label: 'نسبة الهدر الافتراضية %', type: 'number' },
  { key: 'margin_default', label: 'هامش الربح الافتراضي %', type: 'number' },
];

export default function SettingsPage() {
  const toast = useToast();
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get('/api/settings')
      .then(r => setSettings(r.data))
      .catch(() => toast.error('فشل تحميل الإعدادات'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put('/api/settings', settings);
      setSettings(data);
      toast.success('تم حفظ الإعدادات بنجاح');
    } catch { toast.error('فشل حفظ الإعدادات'); }
    finally { setSaving(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[#1a1a2e]">الإعدادات</h2>
          <p className="text-xs text-gray-400 mt-0.5">القيم الافتراضية للنظام</p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-5 py-2 bg-[#c9a84c] hover:bg-[#b8973f] text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50">
          <Save size={16} /> {saving ? 'جاري الحفظ...' : 'حفظ'}
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6 space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          هذه القيم ستُطبَّق تلقائياً على كل موديل جديد
        </div>
        {FIELDS.map(f => (
          <div key={f.key}>
            <label className="block text-sm text-gray-600 mb-1">{f.label}</label>
            <input
              type={f.type}
              value={settings[f.key] ?? ''}
              onChange={e => setSettings(prev => ({ ...prev, [f.key]: e.target.value }))}
              className="w-full max-w-xs border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-[#c9a84c] outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
