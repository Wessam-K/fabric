import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, X, Factory, DollarSign, Wrench, FileText } from 'lucide-react';

const ACTIONS = [
  { label: 'أمر تشغيل', icon: Factory, path: '/work-orders/new', color: 'bg-blue-500' },
  { label: 'مصروف', icon: DollarSign, path: '/expenses', color: 'bg-green-500' },
  { label: 'صيانة', icon: Wrench, path: '/maintenance', color: 'bg-amber-500' },
  { label: 'فاتورة', icon: FileText, path: '/invoices', color: 'bg-purple-500' },
];

export default function QuickActions() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col-reverse items-center gap-2">
      {open && ACTIONS.map((a, i) => (
        <button key={i} onClick={() => { navigate(a.path); setOpen(false); }}
          className={`${a.color} text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg hover:scale-110 transition-all`}
          title={a.label}
          style={{ animationDelay: `${i * 50}ms` }}>
          <a.icon size={18} />
        </button>
      ))}
      {open && (
        <div className="absolute bottom-14 left-0 bg-white rounded-lg shadow-xl border p-2 whitespace-nowrap text-xs text-gray-500 pointer-events-none">
          إجراءات سريعة
        </div>
      )}
      <button onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${open ? 'bg-red-500 rotate-45' : 'bg-[#c9a84c] hover:bg-[#b8973e]'} text-white`}>
        {open ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  );
}
