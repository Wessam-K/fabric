import { useState, useRef } from 'react';
import { Upload, X, Download, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import api from '../utils/api';
import { useToast } from './Toast';

/**
 * ImportCSV - Reusable CSV import modal component
 * 
 * Props:
 * - isOpen: boolean - controls modal visibility
 * - onClose: () => void - callback to close modal
 * - endpoint: string - API endpoint for import (e.g., '/expenses/import')
 * - templateColumns: string[] - column names for template download
 * - entityName: string - Arabic name of entity (e.g., 'مصروفات')
 * - onSuccess: (result) => void - callback after successful import
 * - helpText: string - Arabic instructions for the import
 */
export default function ImportCSV({ 
  isOpen, 
  onClose, 
  endpoint, 
  templateColumns = [], 
  entityName = 'البيانات',
  onSuccess,
  helpText = ''
}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);
  const toast = useToast();

  const reset = () => {
    setFile(null);
    setPreview([]);
    setResult(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseCSV = (text) => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
      const values = [];
      let current = '';
      let inQuotes = false;
      
      for (const char of lines[i]) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      values.push(current.trim());
      
      if (values.length === headers.length) {
        const row = {};
        headers.forEach((h, idx) => {
          row[h] = values[idx];
        });
        rows.push(row);
      }
    }
    
    return rows;
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    
    if (!f.name.endsWith('.csv')) {
      toast.error('يرجى اختيار ملف CSV');
      return;
    }
    
    setFile(f);
    setResult(null);
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const rows = parseCSV(text);
        setPreview(rows.slice(0, 5)); // Show first 5 rows
      }
    };
    reader.readAsText(f, 'utf-8');
  };

  const handleImport = async () => {
    if (!file) return;
    
    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const text = event.target?.result;
        if (typeof text !== 'string') return;
        
        const rows = parseCSV(text);
        if (rows.length === 0) {
          toast.error('الملف فارغ أو بتنسيق خاطئ');
          setLoading(false);
          return;
        }
        
        try {
          const { data } = await api.post(endpoint, rows);
          setResult(data);
          toast.success(`تم استيراد ${data.inserted || 0} سجل بنجاح`);
          onSuccess?.(data);
        } catch (err) {
          toast.error(err.response?.data?.error || 'فشل الاستيراد');
          setResult({ inserted: 0, errors: [{ row: 0, error: err.response?.data?.error || 'خطأ غير معروف' }] });
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(file, 'utf-8');
    } catch (err) {
      toast.error('فشل قراءة الملف');
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    if (templateColumns.length === 0) return;
    
    const bom = '\uFEFF';
    const csv = bom + templateColumns.join(',') + '\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template_${entityName.replace(/\s/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()} dir="rtl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-bold text-lg" style={{ color: 'var(--color-navy)' }}>
            استيراد {entityName} من CSV
          </h3>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {/* Help Text */}
          {helpText && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-blue-700">
              <div className="flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <p>{helpText}</p>
              </div>
            </div>
          )}

          {/* Template Download */}
          {templateColumns.length > 0 && (
            <button
              onClick={downloadTemplate}
              className="btn btn-outline text-sm flex items-center gap-2"
            >
              <Download size={14} />
              تنزيل نموذج CSV
            </button>
          )}

          {/* File Upload */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center cursor-pointer hover:border-[#c9a84c] transition-colors"
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload size={32} className="mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-500">
              {file ? file.name : 'اضغط لاختيار ملف CSV أو اسحبه هنا'}
            </p>
          </div>

          {/* Preview */}
          {preview.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b flex items-center gap-2">
                <FileText size={14} className="text-gray-500" />
                <span className="text-xs text-gray-600">معاينة أول 5 صفوف</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(preview[0]).map((col, i) => (
                        <th key={i} className="text-right py-2 px-2 font-medium text-gray-600 border-b">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row).map((val, j) => (
                          <td key={j} className="py-2 px-2 text-gray-700">
                            {String(val).slice(0, 30)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className={`border rounded-lg p-3 ${result.inserted > 0 && (!result.errors || result.errors.length === 0) ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {result.inserted > 0 ? (
                  <CheckCircle size={16} className="text-green-600" />
                ) : (
                  <AlertCircle size={16} className="text-yellow-600" />
                )}
                <span className="font-medium">
                  تم استيراد {result.inserted || 0} سجل
                  {result.errors?.length > 0 && ` — ${result.errors.length} خطأ`}
                </span>
              </div>
              {result.errors?.length > 0 && (
                <ul className="text-xs text-red-600 space-y-1 mt-2">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i}>صف {err.row}: {err.error}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li>... و {result.errors.length - 5} أخطاء أخرى</li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t">
          <button onClick={handleClose} className="btn btn-secondary">
            {result ? 'إغلاق' : 'إلغاء'}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="btn btn-gold disabled:opacity-50"
            >
              {loading ? 'جاري الاستيراد...' : 'استيراد'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
