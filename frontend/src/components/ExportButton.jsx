import { Download } from 'lucide-react';

export default function ExportButton({ data, filename = 'export', columns }) {
  const handleExport = () => {
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
    <button onClick={handleExport} disabled={!data?.length}
      className="btn btn-outline btn-sm flex items-center gap-1.5 disabled:opacity-40">
      <Download size={14} />
      تصدير CSV
    </button>
  );
}
