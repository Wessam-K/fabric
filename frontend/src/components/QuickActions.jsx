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
    <div className="fixed bottom-6 right-6 z-40 flex flex-col-reverse items-end gap-2">
      {open && ACTIONS.map((a, i) => (
        <div key={i} className="flex items-center gap-2 justify-end" style={{ animationDelay: `${i * 50}ms` }}>
          <span className="bg-white text-gray-700 text-xs font-bold px-2.5 py-1.5 rounded-lg shadow border whitespace-nowrap">
            {a.label}
          </span>
          <button onClick={() => { navigate(a.path); setOpen(false); }}
            className={`${a.color} text-white rounded-full w-11 h-11 flex items-center justify-center shadow-lg hover:scale-110 transition-all`}>
            <a.icon size={18} />
          </button>
        </div>
      ))}
      <button onClick={() => setOpen(!open)}
        className={`w-14 h-14 rounded-full shadow-xl flex items-center justify-center transition-all duration-200 ${open ? 'bg-red-500 rotate-45' : 'bg-[#c9a84c] hover:bg-[#b8973e]'} text-white`}>
        {open ? <X size={24} /> : <Plus size={24} />}
      </button>
    </div>
  );
}
