import { useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import helpContent from '../utils/helpContent';

export default function HelpButton({ pageKey }) {
  const [open, setOpen] = useState(false);
  const content = helpContent[pageKey];
  if (!content) return null;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-[#c9a84c] hover:bg-yellow-50 transition-colors"
        title="مساعدة">
        <HelpCircle size={18} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()} dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>{content.title}</h3>
                <p className="text-sm text-gray-500">{content.description}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="p-4 space-y-4">
              {content.sections.map((section, i) => (
                <div key={i}>
                  <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--color-navy)' }}>{section.title}</h4>
                  <p className="text-sm text-gray-600 leading-relaxed">{section.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
