import { useState, useEffect } from 'react';
import api from '../utils/api';

/**
 * Phase 6.3: License/Trial banner — shows remaining trial days or expiry warning
 */
export default function LicenseBanner() {
  const [license, setLicense] = useState(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    api.get('/license/status').then(r => setLicense(r.data)).catch(() => {});
  }, []);

  if (!license || dismissed) return null;

  const { license_type, days_left, status } = license;
  if (license_type === 'enterprise' && status === 'active') return null;

  let message = null;
  let bgColor = 'bg-yellow-500';

  if (status === 'expired') {
    message = 'انتهت صلاحية الترخيص. يرجى تجديد الترخيص للاستمرار.';
    bgColor = 'bg-red-600';
  } else if (license_type === 'trial') {
    if (days_left <= 7) {
      message = `الفترة التجريبية تنتهي خلال ${days_left} يوم. قم بالترقية الآن.`;
      bgColor = days_left <= 3 ? 'bg-red-600' : 'bg-yellow-500';
    } else {
      message = `فترة تجريبية — متبقي ${days_left} يوم`;
    }
  } else if (days_left <= 30) {
    message = `ينتهي الترخيص خلال ${days_left} يوم`;
  }

  if (!message) return null;

  return (
    <div className={`${bgColor} text-white text-center py-1.5 px-4 text-sm flex items-center justify-center gap-3`}>
      <span>{message}</span>
      <button onClick={() => setDismissed(true)} className="text-white/80 hover:text-white text-lg leading-none">&times;</button>
    </div>
  );
}
