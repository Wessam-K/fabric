/** Shared formatting utilities */

export const fmtNum = (n) => Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

export const fmtMoney = (n) => `${fmtNum(n)} ج`;

export const fmtDate = (d) => d ? new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

export const fmtDateTime = (d) => d ? new Date(d).toLocaleString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const fmtPercent = (n) => `${(n || 0).toFixed(1)}%`;

export const downloadCSV = (rows, filename) => {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const safe = (v) => { const s = (v ?? '').toString().replace(/"/g, '""'); return /^[=+\-@\t\r]/.test(s) ? `"'${s}"` : `"${s}"`; };
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => headers.map(h => safe(r[h])).join(','))].join('\n');
  const a = document.createElement('a');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
