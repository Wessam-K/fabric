import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const SIZES = ['qty_s', 'qty_m', 'qty_l', 'qty_xl', 'qty_2xl', 'qty_3xl'];
const SIZE_LABELS = ['S', 'M', 'L', 'XL', '2XL', '3XL'];

export default function PrintView() {
  const { code } = useParams();
  const [model, setModel] = useState(null);
  const [cost, setCost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/models/${code}`)
      .then(r => {
        setModel(r.data);
        setCost(r.data.cost_summary);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    if (!loading && model) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, model]);

  if (loading) return <div className="flex items-center justify-center h-screen"><p>جاري التحميل...</p></div>;
  if (!model) return <div className="flex items-center justify-center h-screen"><p>الموديل غير موجود</p></div>;

  const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const mainFabrics = (model.fabrics || []).filter(f => f.role === 'main');
  const linings = (model.fabrics || []).filter(f => f.role === 'lining');
  const rowTotal = (row) => SIZES.reduce((s, k) => s + (parseInt(row[k]) || 0), 0);
  const grandTotal = (model.sizes || []).reduce((s, row) => s + rowTotal(row), 0);

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-6 text-sm font-[Cairo] print:p-2 print:text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-[#1a1a2e] pb-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">بطاقة الموديل</h1>
          <p className="text-gray-500 text-xs mt-1">WK-Hub — نظام إدارة المصنع</p>
        </div>
        <div className="text-left">
          <p className="font-mono text-lg font-bold text-[#1a1a2e]">{model.model_code}</p>
          <p className="font-mono text-xs text-gray-500">{model.serial_number}</p>
          <p className="text-xs text-gray-400">{new Date(model.created_at).toLocaleDateString('ar-EG')}</p>
        </div>
      </div>

      {/* Model Info + Image */}
      <div className="flex gap-6 mb-6">
        {model.model_image && (
          <div className="w-32 h-32 rounded-xl overflow-hidden border shrink-0">
            <img src={model.model_image} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          <table className="w-full">
            <tbody>
              {model.model_name && <tr><td className="text-gray-500 py-1 w-28">اسم الموديل:</td><td className="font-bold">{model.model_name}</td></tr>}
              {model.notes && <tr><td className="text-gray-500 py-1">ملاحظات:</td><td>{model.notes}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fabrics */}
      {mainFabrics.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-[#1a1a2e] border-b border-gray-300 pb-1 mb-2">الأقمشة الأساسية</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs">
                <th className="px-2 py-1.5 text-right">القماش</th>
                <th className="px-2 py-1.5 text-center">مشراج/م</th>
                <th className="px-2 py-1.5 text-center">سعر/م</th>
                <th className="px-2 py-1.5 text-center">هدر%</th>
                <th className="px-2 py-1.5 text-center">اللون</th>
              </tr>
            </thead>
            <tbody>
              {mainFabrics.map((f, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-2 py-1.5 font-mono text-xs">[{f.fabric_code}] {f.fabric_name || ''}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{f.meters_per_piece}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{f.registry_price} ج</td>
                  <td className="px-2 py-1.5 text-center font-mono">{f.waste_pct}%</td>
                  <td className="px-2 py-1.5 text-center">{f.color_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {linings.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-[#1a1a2e] border-b border-gray-300 pb-1 mb-2">البطانة</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs">
                <th className="px-2 py-1.5 text-right">القماش</th>
                <th className="px-2 py-1.5 text-center">مشراج/م</th>
                <th className="px-2 py-1.5 text-center">سعر/م</th>
                <th className="px-2 py-1.5 text-center">اللون</th>
              </tr>
            </thead>
            <tbody>
              {linings.map((f, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-2 py-1.5 font-mono text-xs">[{f.fabric_code}] {f.fabric_name || ''}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{f.meters_per_piece}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{f.registry_price} ج</td>
                  <td className="px-2 py-1.5 text-center">{f.color_note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Size Grid */}
      {model.sizes?.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-[#1a1a2e] border-b border-gray-300 pb-1 mb-2">جدول المقاسات</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs">
                <th className="px-2 py-1.5 text-right">اللون</th>
                {SIZE_LABELS.map(s => <th key={s} className="px-2 py-1.5 text-center font-mono">{s}</th>)}
                <th className="px-2 py-1.5 text-center font-mono">إجمالي</th>
              </tr>
            </thead>
            <tbody>
              {model.sizes.map((row, i) => (
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
                    {model.sizes.reduce((s, row) => s + (parseInt(row[k]) || 0), 0)}
                  </td>
                ))}
                <td className="px-2 py-1.5 text-center font-mono text-lg">{grandTotal}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Accessories */}
      {model.accessories?.length > 0 && (
        <div className="mb-6">
          <h3 className="font-bold text-[#1a1a2e] border-b border-gray-300 pb-1 mb-2">الاكسسوارات</h3>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs">
                <th className="px-2 py-1.5 text-right">الاكسسوار</th>
                <th className="px-2 py-1.5 text-center">الكمية</th>
                <th className="px-2 py-1.5 text-center">سعر الوحدة</th>
                <th className="px-2 py-1.5 text-center">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {model.accessories.map((a, i) => (
                <tr key={i} className="border-t border-gray-200">
                  <td className="px-2 py-1.5">{a.accessory_code ? `[${a.accessory_code}] ` : ''}{a.accessory_name || a.registry_name || ''}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{a.quantity}</td>
                  <td className="px-2 py-1.5 text-center font-mono">{a.unit_price} ج</td>
                  <td className="px-2 py-1.5 text-center font-mono font-bold">{fmt((a.quantity||0) * (a.unit_price||0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Cost Summary */}
      {cost && (
        <div className="mb-6 border-2 border-[#1a1a2e] rounded-xl p-4">
          <h3 className="font-bold text-[#1a1a2e] mb-3">ملخص التكلفة</h3>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-gray-500">تكلفة القماش الأساسي:</span><span className="font-mono text-left">{fmt(cost.main_fabric_cost)} ج</span>
            <span className="text-gray-500">تكلفة البطانة:</span><span className="font-mono text-left">{fmt(cost.lining_cost)} ج</span>
            <span className="text-gray-500">تكلفة الاكسسوارات:</span><span className="font-mono text-left">{fmt(cost.accessories_cost)} ج</span>
            <span className="text-gray-500">المصنعية:</span><span className="font-mono text-left">{fmt(cost.masnaiya)} ج</span>
            <span className="text-gray-500">المصروف:</span><span className="font-mono text-left">{fmt(cost.masrouf)} ج</span>
            <div className="col-span-2 border-t border-gray-300 my-1"></div>
            <span className="font-bold text-[#1a1a2e] text-base">إجمالي التكلفة:</span><span className="font-mono font-bold text-left text-base">{fmt(cost.total_cost)} ج</span>
            <span className="font-bold text-[#c9a84c]">تكلفة القطعة:</span><span className="font-mono font-bold text-[#c9a84c] text-left text-lg">{fmt(cost.cost_per_piece)} ج</span>
            <span className="text-gray-500">عدد القطع:</span><span className="font-mono text-left">{cost.grand_total_pieces}</span>
          </div>
          {(model.consumer_price || model.wholesale_price) && (
            <div className="border-t border-gray-300 mt-3 pt-3 grid grid-cols-2 gap-y-2">
              {model.consumer_price && <><span className="text-gray-500">سعر المستهلك:</span><span className="font-mono font-bold text-left">{fmt(model.consumer_price)} ج</span></>}
              {model.wholesale_price && <><span className="text-gray-500">سعر الجملة:</span><span className="font-mono font-bold text-left">{fmt(model.wholesale_price)} ج</span></>}
            </div>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[10px] text-gray-400 border-t border-gray-200 pt-3">
        طُبع بواسطة نظام WK-Hub — {new Date().toLocaleDateString('ar-EG')} {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>
  );
}
