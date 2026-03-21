import { useState, useEffect, useRef } from 'react';
import { Barcode, Search, Loader2 } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';
import { useNavigate } from 'react-router-dom';

/**
 * BarcodeScanner - A reusable component for barcode scanning
 * 
 * Features:
 * - Accepts manual text input
 * - Detects rapid keystrokes from barcode scanners
 * - Universal lookup across all entities via /api/barcode/:code
 * - Navigates to the relevant page when scanned
 * 
 * Props:
 * - onScan(result) - callback when barcode is found, receives { type, id, data }
 * - placeholder - custom placeholder text
 * - autoNavigate - if true, navigates to entity page on scan (default: true)
 * - className - additional CSS classes
 */
export default function BarcodeScanner({ onScan, placeholder = 'امسح الباركود أو أدخله يدويًا', autoNavigate = true, className = '' }) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const bufferRef = useRef('');
  const timerRef = useRef(null);

  // Route mapping for auto-navigation
  const routeMap = {
    machine: (id) => `/machines/${id}`,
    maintenance: (id) => `/maintenance`,
    fabric: (id) => `/fabrics`,
    accessory: (id) => `/accessories`,
    model: (data) => `/models/${data.model_code}`,
    work_order: (id) => `/work-orders/${id}`,
    supplier: (id) => `/suppliers/${id}`,
    customer: (id) => `/customers/${id}`,
    invoice: (id) => `/invoices/${id}/view`,
    purchase_order: (id) => `/purchase-orders`,
  };

  // Universal barcode lookup
  const lookupBarcode = async (code) => {
    if (!code || code.length < 3) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/barcode/${encodeURIComponent(code)}`);
      if (data && data.type) {
        toast.success(`تم العثور على: ${getTypeLabel(data.type)}`);
        onScan?.(data);
        
        if (autoNavigate && routeMap[data.type]) {
          const route = routeMap[data.type];
          const path = typeof route === 'function' ? route(data.id, data.data) : route;
          navigate(path);
        }
        setValue('');
      }
    } catch (err) {
      if (err.response?.status === 404) {
        toast.error('لم يتم العثور على عنصر بهذا الباركود');
      } else {
        toast.error(err.response?.data?.error || 'خطأ في البحث');
      }
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type) => {
    const labels = {
      machine: 'ماكينة',
      maintenance: 'أمر صيانة',
      fabric: 'قماش',
      accessory: 'إكسسوار',
      model: 'موديل',
      work_order: 'أمر تشغيل',
      supplier: 'مورد',
      customer: 'عميل',
      invoice: 'فاتورة',
      purchase_order: 'أمر شراء',
    };
    return labels[type] || type;
  };

  // Handle rapid keystrokes from barcode scanner
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only capture when input is focused or no input focused
      if (document.activeElement !== inputRef.current && 
          document.activeElement.tagName !== 'BODY') {
        return;
      }

      // Clear buffer after 50ms of inactivity (scanner sends all chars rapidly)
      if (timerRef.current) clearTimeout(timerRef.current);
      
      if (e.key === 'Enter' && bufferRef.current.length >= 3) {
        e.preventDefault();
        const code = bufferRef.current;
        bufferRef.current = '';
        setValue(code);
        lookupBarcode(code);
      } else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) {
        bufferRef.current += e.key;
        timerRef.current = setTimeout(() => {
          bufferRef.current = '';
        }, 50);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (value.trim()) {
      lookupBarcode(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`relative flex items-center gap-2 ${className}`}>
      <div className="relative flex-1">
        <Barcode size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          className="w-full pr-10 pl-3 py-2 text-sm border-2 border-gray-200 rounded-lg focus:border-[#c9a84c] outline-none transition-colors"
          disabled={loading}
          dir="ltr"
        />
      </div>
      <button
        type="submit"
        disabled={loading || !value.trim()}
        className="btn btn-gold px-3 py-2 disabled:opacity-50"
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
      </button>
    </form>
  );
}

/**
 * BarcodeDisplay - Shows a barcode value with copy button
 */
export function BarcodeDisplay({ code, showCopy = true, className = '' }) {
  const toast = useToast();

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      toast.success('تم نسخ الباركود');
    });
  };

  if (!code) return <span className="text-gray-400">—</span>;

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${className}`}>
      <Barcode size={12} className="text-gray-400" />
      <span>{code}</span>
      {showCopy && (
        <button
          onClick={handleCopy}
          className="text-blue-500 hover:text-blue-700 p-0.5"
          title="نسخ الباركود"
        >
          📋
        </button>
      )}
    </span>
  );
}
