import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Printer, Copy, Check } from 'lucide-react';
import api from '../utils/api';

const SIZES = ['qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl'];
const SIZE_LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export default function InvoicePrint() {
  const { code } = useParams();
  const [model, setModel] = useState(null);
  const [tmpl, setTmpl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: m } = await api.get(`/models/${code}`);
        setModel(m);
        const defTmpl = (m.bom_templates || []).find(t => t.is_default) || (m.bom_templates || [])[0];
        if (defTmpl) {
          const { data: full } = await api.get(`/models/${code}/bom-templates/${defTmpl.id}`);
          setTmpl(full);
        }
      } catch {}
      finally { setLoading(false); }
    };
    load();
  }, [code]);

  const handlePrint = () => window.print();
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  if (!model) return <div className="flex items-center justify-center h-screen"><p className="text-gray-400 text-lg">الموديل غير موجود</p></div>;

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mainFabrics = (tmpl?.fabrics || []).filter(f => f.role === 'main');
  const linings = (tmpl?.fabrics || []).filter(f => f.role === 'lining');
  const sizes = tmpl?.sizes || [];
  const accessories = tmpl?.accessories || [];
  const rowTotal = (row) => SIZES.reduce((s, k) => s + (parseInt(row[k]) || 0), 0);
  const grandTotal = sizes.reduce((s, row) => s + rowTotal(row), 0);

  return (
    <>
      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
          .invoice-page { box-shadow: none !important; margin: 0 !important; padding: 20mm 15mm !important; }
        }
        @page { size: A4; margin: 0; }
      `}</style>

      {/* Action Bar (hidden in print) */}
      <div className="no-print fixed top-4 left-4 z-50 flex gap-2">
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold shadow-lg hover:bg-[#b8973f] transition-colors">
          <Printer size={16} /> طباعة / PDF
        </button>
        <button onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm shadow-lg hover:bg-gray-50 transition-colors border border-gray-200">
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          {copied ? 'تم النسخ' : 'نسخ الرابط'}
        </button>
      </div>

      {/* A4 Invoice Page */}
      <div dir="rtl" className="invoice-page max-w-[210mm] mx-auto my-8 bg-white shadow-xl p-[20mm] text-sm font-[Cairo] min-h-[297mm]">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-[#1a1a2e] pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">فاتورة تكلفة الموديل</h1>
            <p className="text-xs text-gray-400 mt-1">WK-Hub — نظام إدارة المصنع</p>
          </div>
          <div className="text-left">
            <p className="font-mono text-xl font-bold text-[#1a1a2e]">{model.model_code}</p>
            <p className="font-mono text-xs text-gray-500">#{model.serial_number}</p>
            <p className="text-xs text-gray-400 mt-1">{new Date(model.created_at).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
        </div>

        {/* Model info row */}
        <div className="flex gap-6 mb-6">
          {model.model_image && (
            <div className="w-28 h-28 rounded-xl overflow-hidden border shrink-0">
              <img src={model.model_image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="flex-1">
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
              {model.model_name && <><span className="text-gray-500">اسم الموديل:</span><span className="font-bold">{model.model_name}</span></>}
              <span className="text-gray-500">إجمالي القطع:</span><span className="font-bold font-mono">{grandTotal}</span>
              {model.notes && <><span className="text-gray-500">ملاحظات:</span><span>{model.notes}</span></>}
            </div>
          </div>
        </div>

        {/* Main Fabrics Table */}
        {mainFabrics.length > 0 && (
          <div className="mb-5">
            <h3 className="font-bold text-[#1a1a2e] text-xs uppercase tracking-wider border-b border-gray-300 pb-1 mb-2">الأقمشة الأساسية</h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1a1a2e]/5">
                  <th className="px-2 py-1.5 text-right font-bold">القماش</th>
                  <th className="px-2 py-1.5 text-center font-bold">مشراج/م</th>
                  <th className="px-2 py-1.5 text-center font-bold">سعر/م</th>
                  <th className="px-2 py-1.5 text-center font-bold">هدر%</th>
                  <th className="px-2 py-1.5 text-center font-bold">اللون</th>
                  <th className="px-2 py-1.5 text-center font-bold">التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {mainFabrics.map((f, i) => {
                  const meters = (f.meters_per_piece || 0) * grandTotal;
                  const c = meters * (f.price_per_m || 0) * (1 + (f.waste_pct || 0) / 100);
                  return (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-2 py-1.5 font-mono">[{f.fabric_code}] {f.fabric_name || ''}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{f.meters_per_piece}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{f.price_per_m} ج</td>
                      <td className="px-2 py-1.5 text-center font-mono">{f.waste_pct}%</td>
                      <td className="px-2 py-1.5 text-center">{f.color_note || '—'}</td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold">{fmt(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Linings Table */}
        {linings.length > 0 && (
          <div className="mb-5">
            <h3 className="font-bold text-[#1a1a2e] text-xs uppercase tracking-wider border-b border-gray-300 pb-1 mb-2">البطانة</h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1a1a2e]/5">
                  <th className="px-2 py-1.5 text-right font-bold">القماش</th>
                  <th className="px-2 py-1.5 text-center font-bold">مشراج/م</th>
                  <th className="px-2 py-1.5 text-center font-bold">سعر/م</th>
                  <th className="px-2 py-1.5 text-center font-bold">اللون</th>
                  <th className="px-2 py-1.5 text-center font-bold">التكلفة</th>
                </tr>
              </thead>
              <tbody>
                {linings.map((f, i) => {
                  const meters = (f.meters_per_piece || 0) * grandTotal;
                  const c = meters * (f.price_per_m || 0);
                  return (
                    <tr key={i} className="border-t border-gray-200">
                      <td className="px-2 py-1.5 font-mono">[{f.fabric_code}] {f.fabric_name || ''}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{f.meters_per_piece}</td>
                      <td className="px-2 py-1.5 text-center font-mono">{f.price_per_m} ج</td>
                      <td className="px-2 py-1.5 text-center">{f.color_note || '—'}</td>
                      <td className="px-2 py-1.5 text-center font-mono font-bold">{fmt(c)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Size Grid */}
        {sizes.length > 0 && (
          <div className="mb-5">
            <h3 className="font-bold text-[#1a1a2e] text-xs uppercase tracking-wider border-b border-gray-300 pb-1 mb-2">جدول المقاسات</h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1a1a2e]/5">
                  <th className="px-2 py-1.5 text-right font-bold">اللون</th>
                  {SIZE_LABELS.map(s => <th key={s} className="px-2 py-1.5 text-center font-mono font-bold">{s}</th>)}
                  <th className="px-2 py-1.5 text-center font-mono font-bold">المجموع</th>
                </tr>
              </thead>
              <tbody>
                {sizes.map((row, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-2 py-1.5">{row.color_label}</td>
                    {SIZES.map(k => <td key={k} className="px-2 py-1.5 text-center font-mono">{row[k] || 0}</td>)}
                    <td className="px-2 py-1.5 text-center font-mono font-bold">{rowTotal(row)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-400 font-bold bg-gray-50">
                  <td className="px-2 py-1.5">إجمالي القص</td>
                  {SIZES.map(k => (
                    <td key={k} className="px-2 py-1.5 text-center font-mono">
                      {sizes.reduce((s, row) => s + (parseInt(row[k]) || 0), 0)}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-center font-mono text-base">{grandTotal}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Accessories Table */}
        {accessories.length > 0 && (
          <div className="mb-5">
            <h3 className="font-bold text-[#1a1a2e] text-xs uppercase tracking-wider border-b border-gray-300 pb-1 mb-2">الاكسسوارات</h3>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#1a1a2e]/5">
                  <th className="px-2 py-1.5 text-right font-bold">الاكسسوار</th>
                  <th className="px-2 py-1.5 text-center font-bold">الكمية</th>
                  <th className="px-2 py-1.5 text-center font-bold">سعر الوحدة</th>
                  <th className="px-2 py-1.5 text-center font-bold">الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {accessories.map((a, i) => (
                  <tr key={i} className="border-t border-gray-200">
                    <td className="px-2 py-1.5">{a.accessory_code ? `[${a.accessory_code}] ` : ''}{a.name || a.registry_name || ''}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{a.quantity}</td>
                    <td className="px-2 py-1.5 text-center font-mono">{a.unit_price} ج</td>
                    <td className="px-2 py-1.5 text-center font-mono font-bold">{fmt((a.quantity||0) * (a.unit_price||0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cost Summary Box */}
        {tmpl && (
          <div className="border-2 border-[#1a1a2e] rounded-xl p-5 mb-5">
            <h3 className="font-bold text-[#1a1a2e] mb-3 text-sm">ملخص التكلفة (قالب: {tmpl.template_name})</h3>
            <div className="grid grid-cols-2 gap-y-2 text-xs">
              <span className="text-gray-500">المصنعية:</span><span className="font-mono text-left">{fmt(tmpl.masnaiya)} ج</span>
              <span className="text-gray-500">المصروف:</span><span className="font-mono text-left">{fmt(tmpl.masrouf)} ج</span>
              <span className="text-gray-500">هامش الربح:</span><span className="font-mono text-left">{tmpl.margin_pct || 0}%</span>
              <span className="text-gray-500">عدد القطع:</span><span className="font-mono text-left">{grandTotal}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-[9px] text-gray-400 border-t border-gray-200 pt-3 mt-auto">
          طُبع بواسطة نظام WK-Hub — {new Date().toLocaleDateString('ar-EG')} {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </>
  );
}
