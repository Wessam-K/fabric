import { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../utils/api';

export default function ExportButton({ data, filename = 'export', columns, backendEndpoint }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    // If backend endpoint is provided, fetch ALL records from server
    if (backendEndpoint) {
      setLoading(true);
      try {
        const res = await api.get(backendEndpoint, { responseType: 'blob' });
        const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        // Fallback to client-side export
        exportClientSide();
      } finally {
        setLoading(false);
      }
      return;
    }

    exportClientSide();
  };

  const exportClientSide = () => {
    if (!data || data.length === 0) return;

    const headers = columns ? columns.map(c => c.label) : Object.keys(data[0]);
    const keys = columns ? columns.map(c => c.key) : Object.keys(data[0]);

    const csvRows = [
      headers.join(','),
      ...data.map(row => keys.map(k => {
        const val = row[k] ?? '';
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(','))
    ];

    const bom = '\uFEFF';
    const blob = new Blob([bom + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button onClick={handleExport} disabled={loading || (!backendEndpoint && !data?.length)}
      className="btn btn-outline btn-sm flex items-center gap-1.5 disabled:opacity-40">
      <Download size={14} />
      {loading ? 'جاري التصدير...' : 'تصدير CSV'}
    </button>
  );
}
