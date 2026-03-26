import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Search } from 'lucide-react';
import api from '../utils/api';
import { PageHeader, LoadingState } from '../components/ui';
import HelpButton from '../components/HelpButton';
import { useNavigate } from 'react-router-dom';

const TYPE_LABELS = { low_stock: 'مخزون منخفض', low_stock_fabric: 'مخزون قماش', low_stock_accessory: 'مخزون إكسسوار', overdue: 'متأخر', overdue_invoice: 'فاتورة متأخرة', overdue_work_order: 'أمر متأخر', overdue_maintenance: 'صيانة متأخرة', maintenance_upcoming: 'صيانة قادمة', maintenance_stale: 'صيانة معلقة', expense_pending: 'مصروف معلق', machine_broken: 'ماكينة معطلة', machine_idle: 'ماكينة متوقفة', info: 'معلومات', warning: 'تنبيه', system: 'نظام' };
const TYPE_COLORS = { low_stock: 'bg-orange-100 text-orange-700', low_stock_fabric: 'bg-orange-100 text-orange-700', low_stock_accessory: 'bg-orange-100 text-orange-700', overdue: 'bg-red-100 text-red-700', overdue_invoice: 'bg-red-100 text-red-700', overdue_work_order: 'bg-red-100 text-red-700', overdue_maintenance: 'bg-red-100 text-red-700', maintenance_upcoming: 'bg-yellow-100 text-yellow-700', maintenance_stale: 'bg-yellow-100 text-yellow-700', expense_pending: 'bg-purple-100 text-purple-700', machine_broken: 'bg-red-100 text-red-700', machine_idle: 'bg-gray-100 text-gray-700', info: 'bg-blue-100 text-blue-700', warning: 'bg-yellow-100 text-yellow-700', system: 'bg-gray-100 text-gray-600' };
const NAV_MAP = { fabric: '/fabrics', accessory: '/accessories', work_order: '/work-orders', invoice: '/invoices', purchase_order: '/purchase-orders', customer: '/customers', maintenance: '/maintenance', machine: '/machines', expense: '/expenses' };

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // all | unread | low_stock | overdue
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filter === 'unread') params.unread_only = 'true';
      const { data } = await api.get('/notifications', { params });
      setItems(data.notifications || []);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filter]);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setItems(items.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setItems(items.map(n => ({ ...n, is_read: 1 })));
    } catch {}
  };

  const remove = async (id) => {
    try {
      await api.delete(`/notifications/${id}`);
      setItems(items.filter(n => n.id !== id));
    } catch {}
  };

  const handleClick = (n) => {
    if (!n.is_read) markRead(n.id);
    if (n.reference_type && NAV_MAP[n.reference_type]) {
      const path = n.reference_id ? `${NAV_MAP[n.reference_type]}/${n.reference_id}` : NAV_MAP[n.reference_type];
      navigate(path);
    }
  };

  const filtered = items.filter(n => {
    if (filter === 'low_stock' && !n.type?.includes('low_stock')) return false;
    if (filter === 'overdue' && !n.type?.includes('overdue')) return false;
    if (search && !(n.title || '').includes(search) && !(n.body || n.message || '').includes(search)) return false;
    return true;
  });

  const unreadCount = items.filter(n => !n.is_read).length;

  return (
    <div className="page">
      <PageHeader title="الإشعارات" subtitle={`${items.length} إشعار · ${unreadCount} غير مقروء`}
        actions={
          <div className="flex items-center gap-2">
            <HelpButton pageKey="notifications" />
            <button onClick={markAllRead} disabled={!unreadCount} className="btn btn-ghost text-xs disabled:opacity-40">
              <CheckCheck size={14} /> تعليم الكل كمقروء
            </button>
          </div>
        }
      />

      <div className="flex gap-3 flex-wrap items-center mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="form-input w-full pr-8" />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
          {[{ v: 'all', l: 'الكل' }, { v: 'unread', l: 'غير مقروء' }, { v: 'low_stock', l: 'مخزون' }, { v: 'overdue', l: 'متأخر' }].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v)} className={`px-3 py-1 rounded text-xs font-bold transition-all ${filter === f.v ? 'bg-white shadow-sm text-[#1a1a2e]' : 'text-gray-500'}`}>{f.l}</button>
          ))}
        </div>
      </div>

      {loading ? <LoadingState /> : (
        <div className="space-y-2">
          {filtered.map(n => (
            <div key={n.id} onClick={() => handleClick(n)}
              className={`bg-white rounded-2xl shadow-sm p-4 flex items-start gap-3 cursor-pointer hover:shadow-md transition-all ${!n.is_read ? 'border-r-4 border-[#c9a84c]' : ''}`}>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${TYPE_COLORS[n.type] || TYPE_COLORS.info}`}>
                <Bell size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${TYPE_COLORS[n.type] || TYPE_COLORS.info}`}>
                    {TYPE_LABELS[n.type] || n.type}
                  </span>
                  {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#c9a84c]" />}
                </div>
                <p className="text-sm font-bold text-[#1a1a2e] truncate">{n.title}</p>
                <p className="text-xs text-gray-500 truncate">{n.body}</p>
                <p className="text-[10px] text-gray-300 mt-1">{new Date(n.created_at).toLocaleString('ar-EG')}</p>
              </div>
              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                {!n.is_read && <button onClick={() => markRead(n.id)} className="text-gray-300 hover:text-green-500" title="تعليم كمقروء"><Check size={14} /></button>}
                <button onClick={() => remove(n.id)} className="text-gray-300 hover:text-red-500" title="حذف"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Bell size={40} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد إشعارات</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
