/**
 * Convert rows to CSV string.
 * @param {Array<Object>} rows - Array of row objects
 * @param {Array<string>} columns - Column names to include
 * @returns {string} CSV string
 */
function toCSV(rows, columns) {
  const quoteCol = c => '"' + String(c).replace(/"/g, '""') + '"';
  if (!rows || rows.length === 0) return '\uFEFF' + columns.map(quoteCol).join(',') + '\n';
  const header = columns.map(quoteCol).join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col] == null ? '' : String(row[col]);
      return '"' + val.replace(/"/g, '""') + '"';
    }).join(',')
  );
  return '\uFEFF' + header + '\n' + lines.join('\n');
}

module.exports = { toCSV };
