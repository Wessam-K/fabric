/**
 * Convert rows to CSV string.
 * @param {Array<Object>} rows - Array of row objects
 * @param {Array<string>} columns - Column names to include
 * @returns {string} CSV string
 */
function toCSV(rows, columns) {
  if (!rows || rows.length === 0) return columns.join(',') + '\n';
  const header = columns.join(',');
  const lines = rows.map(row =>
    columns.map(col => {
      const val = row[col] == null ? '' : String(row[col]);
      return '"' + val.replace(/"/g, '""') + '"';
    }).join(',')
  );
  return header + '\n' + lines.join('\n');
}

module.exports = { toCSV };
