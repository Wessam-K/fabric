import api from './api';

/** Download a CSV export from a backend /export endpoint */
export async function exportFromBackend(endpoint, filename) {
  const res = await api.get(endpoint, { responseType: 'blob' });
  const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/** Parse a CSV string into an array of objects using the first row as headers */
export function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const vals = parseLine(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h.trim()] = (vals[i] || '').trim(); });
    return obj;
  });
}

function parseLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { result.push(current); current = ''; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

/** Read a user-selected CSV file, parse it, and POST to a backend /import endpoint */
export async function importFromCSV(endpoint) {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return resolve(null);
      try {
        const text = await file.text();
        const items = parseCSV(text);
        if (!items.length) return reject(new Error('الملف فارغ أو غير صالح'));
        const { data } = await api.post(endpoint, { items });
        resolve(data);
      } catch (err) {
        reject(err.response?.data?.error ? new Error(err.response.data.error) : err);
      }
    };
    input.click();
  });
}
