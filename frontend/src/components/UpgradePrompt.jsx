import { useState } from 'react';
import { Shield, X, Key, ArrowUpCircle } from 'lucide-react';
import api from '../utils/api';

const TIER_INFO = {
  trial:        { label: 'تجريبي', order: 0 },
  standard:     { label: 'أساسي', order: 1 },
  professional: { label: 'احترافي', order: 2 },
  enterprise:   { label: 'مؤسسي', order: 3 },
};

const TIER_FEATURES = {
  standard:     ['حتى 5 مستخدمين', 'أوامر إنتاج غير محدودة', 'مفاتيح API'],
  professional: ['حتى 15 مستخدم', 'جميع المميزات', 'Webhook واحد', 'استيراد جماعي'],
  enterprise:   ['مستخدمون غير محدودين', 'جميع المميزات', 'Webhooks غير محدودة', 'SSO'],
};

export default function UpgradePrompt({ isOpen, onClose, currentTier, blockedFeature, requiredTier }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');
  const [showKeyInput, setShowKeyInput] = useState(false);

  if (!isOpen) return null;

  const current = TIER_INFO[currentTier] || TIER_INFO.trial;
  const required = TIER_INFO[requiredTier] || TIER_INFO.professional;

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError('');
    try {
      await api.post('/license/activate', { license_key: licenseKey.trim() });
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || 'مفتاح ترخيص غير صالح');
    } finally {
      setActivating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a2e] rounded-xl shadow-2xl max-w-lg w-full mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-900/30">
              <ArrowUpCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">ترقية مطلوبة</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">الباقة الحالية: {current.label}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>{blockedFeature || 'هذه الميزة'}</strong> تتطلب باقة <strong>{required.label}</strong> أو أعلى.
          </p>
        </div>

        <div className="space-y-3 mb-6">
          {Object.entries(TIER_FEATURES).map(([tier, features]) => {
            const info = TIER_INFO[tier];
            const isCurrent = tier === currentTier;
            const isRequired = tier === requiredTier;
            return (
              <div key={tier} className={`border rounded-lg p-3 ${isRequired ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-gray-200 dark:border-gray-700'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Shield className="w-4 h-4 text-[#c9a84c]" />
                  <span className="font-semibold text-sm dark:text-white">{info.label}</span>
                  {isCurrent && <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded-full">الحالية</span>}
                  {isRequired && <span className="text-xs bg-[#c9a84c] text-white px-2 py-0.5 rounded-full">مطلوبة</span>}
                </div>
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
                  {features.map((f, i) => <li key={i}>• {f}</li>)}
                </ul>
              </div>
            );
          })}
        </div>

        {showKeyInput ? (
          <div className="space-y-3">
            <input type="text" value={licenseKey} onChange={e => setLicenseKey(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm dark:bg-[#0d0d1a] dark:border-gray-700 dark:text-white font-mono"
              placeholder="أدخل مفتاح الترخيص" dir="ltr" />
            {error && <p className="text-red-500 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button onClick={handleActivate} disabled={activating}
                className="flex-1 px-4 py-2 rounded-lg bg-[#c9a84c] text-white text-sm font-medium hover:bg-[#b8963f] disabled:opacity-50">
                {activating ? 'جاري التفعيل...' : 'تفعيل'}
              </button>
              <button onClick={() => setShowKeyInput(false)}
                className="px-4 py-2 rounded-lg border text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
                رجوع
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <button onClick={() => setShowKeyInput(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#c9a84c] text-white text-sm font-medium hover:bg-[#b8963f]">
              <Key className="w-4 h-4" /> إدخال مفتاح ترخيص
            </button>
            <a href="mailto:sales@wk-factory.com" target="_blank" rel="noopener noreferrer"
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5">
              تواصل مع المبيعات
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
