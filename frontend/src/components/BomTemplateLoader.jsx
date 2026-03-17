import { useState } from 'react';
import { FileDown, X, Check } from 'lucide-react';
import api from '../utils/api';

export default function BomTemplateLoader({ modelCode, templates = [], onLoad }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(null);

  const handleSelect = async (tpl) => {
    if (!modelCode) return;
    setLoading(tpl.id);
    try {
      const { data } = await api.get(`/models/${modelCode}/bom-templates/${tpl.id}`);
      onLoad?.(data);
      setOpen(false);
    } catch { /* handled by parent */ }
    finally { setLoading(null); }
  };

  if (!templates.length) return null;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#c9a84c]/10 text-[#c9a84c] hover:bg-[#c9a84c]/20 rounded-lg text-xs font-bold transition-colors">
        <FileDown size={14} /> تحميل قالب BOM
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-bold text-[#1a1a2e]">اختر قالب BOM</h3>
              <button onClick={() => setOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-auto">
              {templates.map(tpl => (
                <button type="button" key={tpl.id} onClick={() => handleSelect(tpl)}
                  disabled={loading === tpl.id}
                  className={`w-full text-right p-3 rounded-xl border hover:border-[#c9a84c] transition-colors ${tpl.is_default ? 'border-[#c9a84c] bg-[#c9a84c]/5' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-[#1a1a2e]">{tpl.template_name}</span>
                      {tpl.is_default ? <span className="text-[10px] mr-2 px-1.5 py-0.5 bg-[#c9a84c] text-white rounded">افتراضي</span> : null}
                    </div>
                    {loading === tpl.id ? (
                      <div className="animate-spin h-4 w-4 border-2 border-[#c9a84c] border-t-transparent rounded-full" />
                    ) : (
                      <Check size={14} className="text-gray-300" />
                    )}
                  </div>
                  <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                    <span>{tpl.fabric_count || 0} أقمشة</span>
                    <span>{tpl.accessory_count || 0} اكسسوارات</span>
                    <span>{tpl.size_count || 0} مقاسات</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
