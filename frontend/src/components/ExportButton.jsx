import { useState } from 'react';
import { Download } from 'lucide-react';
import api from '../utils/api';

export default function ExportButton({ data, filename = 'export', columns, backendEndpoint, selectedData }) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    // If selected rows provided, export only those
    const exportData = selectedData && selectedData.length > 0 ? selectedData : data;

    // If backend endpoint is provided and no selection, fetch ALL records from server
    if (backendEndpoint && !(selectedData && selectedData.length > 0)) {
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
        exportClientSide(exportData);
      } finally {
        setLoading(false);
      }
      return;
    }

    exportClientSide(exportData);
  };

  const exportClientSide = (rows) => {
    if (!rows || rows.length === 0) return;

    const headers = columns ? columns.map(c => c.label) : Object.keys(rows[0]);
    const keys = columns ? columns.map(c => c.key) : Object.keys(rows[0]);

    const csvRows = [
      headers.join(','),
      ...rows.map(row => keys.map(k => {
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
    <button onClick={handleExport} disabled={loading || (!backendEndpoint && !data?.length && !(selectedData?.length))}
      className="btn btn-outline btn-sm flex items-center gap-1.5 disabled:opacity-40">
      <Download size={14} />
      {loading ? 'جاري التصدير...' : selectedData?.length ? `تصدير ${selectedData.length} محدد` : 'تصدير CSV'}
    </button>
  );
}
