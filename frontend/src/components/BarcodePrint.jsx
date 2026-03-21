import { useRef } from 'react';
import { Printer } from 'lucide-react';

function BarcodeBar({ code }) {
  // Simple Code128-style visual barcode using CSS bars
  const bars = [];
  for (let i = 0; i < code.length; i++) {
    const charCode = code.charCodeAt(i);
    bars.push(
      <span key={i * 3} style={{ width: (charCode % 3) + 1, height: '100%', background: '#000', display: 'inline-block' }} />,
      <span key={i * 3 + 1} style={{ width: (charCode % 2) + 1, height: '100%', background: '#fff', display: 'inline-block' }} />,
      <span key={i * 3 + 2} style={{ width: ((charCode + i) % 3) + 1, height: '100%', background: '#000', display: 'inline-block' }} />
    );
  }
  return <div className="flex items-stretch justify-center" style={{ height: 40 }}>{bars}</div>;
}

const SIZES = {
  small: { card: 'w-48 p-2', title: 'text-xs', code: 'text-[10px]', barH: 30 },
  medium: { card: 'w-64 p-3', title: 'text-sm', code: 'text-xs', barH: 40 },
  large: { card: 'w-80 p-4', title: 'text-base', code: 'text-sm', barH: 50 },
};

export default function BarcodePrint({ barcode, title, subtitle, size = 'medium' }) {
  const printRef = useRef();
  const s = SIZES[size] || SIZES.medium;

  const handlePrint = () => {
    const el = printRef.current;
    if (!el) return;
    const win = window.open('', '_blank', 'width=400,height=300');
    win.document.write(`<!DOCTYPE html><html dir="rtl"><head><title>طباعة باركود</title>
      <style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;font-family:sans-serif}
      .card{border:2px solid #000;border-radius:8px;padding:16px;text-align:center;min-width:200px}
      .title{font-weight:bold;margin-bottom:4px}.bars{display:flex;justify-content:center;margin:8px 0}
      .code{font-family:monospace;letter-spacing:2px;font-size:14px}.sub{color:#666;font-size:11px;margin-top:4px}
      @media print{body{margin:0}}</style></head><body>
      <div class="card"><div class="title">${title || ''}</div>
      ${el.querySelector('.barcode-bars')?.outerHTML || ''}
      <div class="code">${barcode}</div>
      ${subtitle ? `<div class="sub">${subtitle}</div>` : ''}
      </div><script>window.onload=()=>{window.print();window.close()}<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className="inline-block">
      <div ref={printRef} className={`${s.card} border-2 border-gray-300 rounded-lg text-center bg-white`}>
        {title && <p className={`font-bold text-gray-800 mb-1 ${s.title}`}>{title}</p>}
        <div className="barcode-bars">
          <BarcodeBar code={barcode} />
        </div>
        <p className={`font-mono tracking-widest text-gray-900 mt-1 ${s.code}`}>{barcode}</p>
        {subtitle && <p className="text-[10px] text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <button onClick={handlePrint} className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 mx-auto">
        <Printer size={12} /> طباعة الباركود
      </button>
    </div>
  );
}
