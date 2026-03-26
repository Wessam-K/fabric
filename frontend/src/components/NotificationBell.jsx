import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, RefreshCw } from 'lucide-react';
import api from '../utils/api';

const NAV_MAP = {
  fabric: '/fabrics',
  accessory: '/accessories',
  work_order: '/work-orders',
  invoice: '/invoices',
  purchase_order: '/purchase-orders',
  customer: '/customers',
  maintenance: '/maintenance',
  machine: '/machines',
  expense: '/expenses',
};

const TYPE_ICONS = {
  overdue_invoice: '📄',
  low_stock_fabric: '🧵',
  low_stock: '📦',
  overdue_work_order: '⚙️',
  overdue: '⏰',
  maintenance_upcoming: '🔧',
  maintenance_stale: '🔧',
  overdue_maintenance: '🔧',
  overdue_po: '🛒',
  expense_pending: '💸',
  machine_idle: '🤖',
  machine_broken: '🤖',
};

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const ref = useRef(null);
  const intervalRef = useRef(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setError(false);
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(load, 30000);
    };
    const stopPolling = () => {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    };
    startPolling();
    const handleVisibility = () => {
      if (document.hidden) stopPolling();
      else { load(); startPolling(); }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => { stopPolling(); document.removeEventListener('visibilitychange', handleVisibility); };
  }, [load]);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    try { await api.patch(`/notifications/${id}/read`); load(); } catch {}
  };

  const markAllRead = async () => {
    try { await api.patch('/notifications/read-all'); load(); } catch {}
  };

  const dismiss = async (e, id) => {
    e.stopPropagation();
    try { await api.delete(`/notifications/${id}`); load(); } catch {}
  };

  const handleNotificationClick = (n) => {
    if (!n.is_read) markRead(n.id);
    const basePath = NAV_MAP[n.reference_type];
    if (basePath && n.reference_id) {
      if (n.reference_type === 'work_order') {
        navigate(`${basePath}/${n.reference_id}`);
      } else {
        navigate(basePath);
      }
      setOpen(false);
    }
  };

  const getIcon = (type) => TYPE_ICONS[type] || '🔔';

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className="relative p-2 text-gray-400 hover:text-[#c9a84c] transition-colors">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-[22rem] sm:w-96 bg-white dark:bg-[#1a1a2e] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 z-[100] max-h-[32rem] overflow-hidden flex flex-col" dir="rtl">
          <div className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-white/8">
            <span className="text-sm font-bold text-[#1a1a2e] dark:text-white">الإشعارات</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-[#c9a84c] hover:underline">تحديد الكل كمقروع</button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="space-y-2 p-3">
                {[1,2,3].map(i => (
                  <div key={i} className="animate-pulse space-y-1.5 py-2">
                    <div className="h-3 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
                    <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded w-full"></div>
                    <div className="h-2 bg-gray-50 dark:bg-white/3 rounded w-1/3"></div>
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-8">
                <p className="text-xs text-red-400 mb-2">فشل تحميل الإشعارات</p>
                <button onClick={load} className="text-xs text-[#c9a84c] hover:underline flex items-center gap-1 mx-auto">
                  <RefreshCw size={12} /> إعادة المحاولة
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">لا توجد إشعارات</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} onClick={() => handleNotificationClick(n)}
                  className={`px-3 py-2.5 border-b border-gray-50 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group relative ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5 shrink-0">{getIcon(n.type)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#1a1a2e] dark:text-white">{n.title}</p>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{n.body || n.message}</p>
                      <p className="text-[9px] text-gray-300 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString('ar-EG') : ''}</p>
                    </div>
                    <button onClick={(e) => dismiss(e, n.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 p-0.5 transition-opacity shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <div className="border-t border-gray-100 dark:border-white/8 p-2 text-center">
            <button onClick={() => { navigate('/notifications'); setOpen(false); }}
              className="text-[11px] text-[#c9a84c] hover:underline">عرض الكل</button>
          </div>
        </div>
      )}
    </div>
  );
}
