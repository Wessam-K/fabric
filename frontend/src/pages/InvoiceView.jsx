import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Printer, ArrowRight, Download, Copy, Check } from 'lucide-react';
import api from '../utils/api';
import { downloadCSV, fmtDateTime } from '../utils/formatters';
import HelpButton from '../components/HelpButton';

const STATUS_MAP = {
  draft: { label: 'مسودة', color: 'bg-gray-100 text-gray-600' },
  sent: { label: 'مُرسلة', color: 'bg-blue-100 text-blue-700' },
  paid: { label: 'مدفوعة', color: 'bg-green-100 text-green-700' },
  overdue: { label: 'متأخرة', color: 'bg-red-100 text-red-700' },
  cancelled: { label: 'ملغاة', color: 'bg-gray-100 text-gray-400' },
};

const fmt = (v) => (Math.round((v || 0) * 100) / 100).toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function InvoiceView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api.get(`/invoices/${id}`)
      .then(r => setInvoice(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const handlePrint = () => window.print();
  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const exportCSV = () => {
    if (!invoice?.items?.length) return;
    const rows = invoice.items.map(item => ({
      'الوصف': item.description,
      'التنوع': item.variant || '',
      'الكمية': item.quantity,
      'السعر': item.unit_price,
      'المجموع': item.total,
    }));
    downloadCSV(rows, `invoice-${invoice.invoice_number}`);
  };

  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin h-10 w-10 border-4 border-[#c9a84c] border-t-transparent rounded-full" /></div>;
  if (!invoice) return <div className="flex items-center justify-center h-screen"><p className="text-gray-400 text-lg">الفاتورة غير موجودة</p></div>;

  const st = STATUS_MAP[invoice.status] || STATUS_MAP.draft;

  return (
    <>
      <style>{`
        @media print { .no-print { display: none !important; } body { margin: 0; } .invoice-page { box-shadow: none !important; margin: 0 !important; padding: 15mm !important; } }
        @page { size: A4; margin: 0; }
      `}</style>

      {/* Action Bar */}
      <div className="no-print fixed top-4 left-4 z-50 flex gap-2">
        <HelpButton pageKey="invoiceview" />
        <button onClick={() => navigate('/invoices')}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm shadow-lg hover:bg-gray-50 border border-gray-200">
          <ArrowRight size={16} /> الفواتير
        </button>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#c9a84c] text-white rounded-lg text-sm font-bold shadow-lg hover:bg-[#b8973f]">
          <Printer size={16} /> طباعة / PDF
        </button>
        <button onClick={exportCSV}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm shadow-lg hover:bg-gray-50 border border-gray-200">
          <Download size={16} /> Excel
        </button>
        <button onClick={handleCopyLink}
          className="flex items-center gap-1.5 px-4 py-2 bg-white text-gray-700 rounded-lg text-sm shadow-lg hover:bg-gray-50 border border-gray-200">
          {copied ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
          {copied ? 'تم النسخ' : 'نسخ الرابط'}
        </button>
      </div>

      {/* A4 Invoice */}
      <div dir="rtl" className="invoice-page max-w-[210mm] mx-auto my-8 bg-white shadow-xl p-[20mm] text-sm font-[Cairo] min-h-[297mm]">
        {/* Header */}
        <div className="flex items-start justify-between border-b-2 border-[#1a1a2e] pb-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">فاتورة</h1>
            <p className="text-xs text-gray-400 mt-1">WK-Hub — نظام إدارة المصنع</p>
          </div>
          <div className="text-left">
            <p className="font-mono text-xl font-bold text-[#1a1a2e]">{invoice.invoice_number}</p>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${st.color}`}>{st.label}</span>
            <p className="text-xs text-gray-400 mt-1">{fmtDateTime(invoice.created_at)}</p>
          </div>
        </div>

        {/* Customer info */}
        <div className="mb-6 bg-gray-50 rounded-xl p-4">
          <h3 className="font-bold text-xs text-gray-500 mb-2">بيانات العميل</h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <span className="text-gray-500">الاسم:</span><span className="font-bold">{invoice.customer_name}</span>
            {invoice.customer_phone && <><span className="text-gray-500">الهاتف:</span><span className="font-mono">{invoice.customer_phone}</span></>}
            {invoice.customer_email && <><span className="text-gray-500">البريد:</span><span>{invoice.customer_email}</span></>}
            {invoice.due_date && <><span className="text-gray-500">تاريخ الاستحقاق:</span><span className="font-mono">{fmtDateTime(invoice.due_date)}</span></>}
          </div>
        </div>

        {/* Items table */}
        <table className="w-full border-collapse text-xs mb-6">
          <thead>
            <tr className="bg-[#1a1a2e] text-white">
              <th className="px-3 py-2.5 text-right font-bold">#</th>
              <th className="px-3 py-2.5 text-right font-bold">الوصف</th>
              <th className="px-3 py-2.5 text-center font-bold">التنوع</th>
              <th className="px-3 py-2.5 text-center font-bold">الكمية</th>
              <th className="px-3 py-2.5 text-center font-bold">سعر الوحدة</th>
              <th className="px-3 py-2.5 text-center font-bold">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {(invoice.items || []).map((item, i) => (
              <tr key={i} className="border-t border-gray-200">
                <td className="px-3 py-2.5 text-gray-400">{i + 1}</td>
                <td className="px-3 py-2.5">
                  <div className="font-bold">{item.description}</div>
                  {item.model_code && <span className="text-[10px] text-gray-400 font-mono">{item.model_code}</span>}
                </td>
                <td className="px-3 py-2.5 text-center text-gray-500">{item.variant || '—'}</td>
                <td className="px-3 py-2.5 text-center font-mono font-bold">{item.quantity}</td>
                <td className="px-3 py-2.5 text-center font-mono">{fmt(item.unit_price)} ج</td>
                <td className="px-3 py-2.5 text-center font-mono font-bold">{fmt(item.total)} ج</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end mb-6">
          <div className="w-72 border-2 border-[#1a1a2e] rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">المجموع الفرعي:</span><span className="font-mono">{fmt(invoice.subtotal)} ج</span></div>
            {invoice.tax_pct > 0 && <div className="flex justify-between"><span className="text-gray-500">ضريبة ({invoice.tax_pct}%):</span><span className="font-mono">{fmt(invoice.subtotal * invoice.tax_pct / 100)} ج</span></div>}
            {invoice.discount > 0 && <div className="flex justify-between"><span className="text-red-500">خصم:</span><span className="font-mono text-red-500">-{fmt(invoice.discount)} ج</span></div>}
            <div className="border-t border-[#c9a84c] pt-2 flex justify-between text-lg font-bold">
              <span className="text-[#1a1a2e]">الإجمالي:</span>
              <span className="font-mono text-[#c9a84c]">{fmt(invoice.total)} ج</span>
            </div>
          </div>
        </div>

        {/* Notes */}
        {invoice.notes && (
          <div className="mb-6 text-xs text-gray-500 border-t border-gray-200 pt-3">
            <span className="font-bold">ملاحظات:</span> {invoice.notes}
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
