import { useState, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import api from '../utils/api';

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get('/notifications', { params: { limit: 20 } });
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      load();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      load();
    } catch {}
  };

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
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col" style={{ minWidth: 300 }}>
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <span className="text-sm font-bold text-[#1a1a2e]">الإشعارات</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[10px] text-[#c9a84c] hover:underline">تحديد الكل كمقروء</button>
            )}
          </div>
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <p className="text-center py-8 text-xs text-gray-400">لا توجد إشعارات</p>
            ) : (
              notifications.map(n => (
                <div key={n.id} onClick={() => !n.is_read && markRead(n.id)}
                  className={`px-3 py-2.5 border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors ${!n.is_read ? 'bg-blue-50/50' : ''}`}>
                  <p className="text-xs font-bold text-[#1a1a2e]">{n.title}</p>
                  <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{n.message}</p>
                  <p className="text-[9px] text-gray-300 mt-1">{n.created_at ? new Date(n.created_at).toLocaleString('ar-EG') : ''}</p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
