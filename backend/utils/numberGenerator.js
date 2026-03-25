/**
 * Centralized number generation utility for all ERP entities.
 * Ensures consistent format, reads prefixes from settings, and is safe
 * to call inside transactions for atomic operations.
 */

const VALID_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function validateIdentifier(name) {
  if (!VALID_IDENTIFIER.test(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return name;
}

/**
 * Entity configuration registry.
 * Each entry defines how numbers are generated for that entity.
 */
const ENTITY_CONFIGS = {
  invoice:          { table: 'invoices',                  column: 'invoice_number',    settingsKey: 'invoice_prefix',           defaultPrefix: 'INV-',  yearBased: false, pad: 3 },
  work_order:       { table: 'work_orders',               column: 'wo_number',         settingsKey: 'wo_prefix',               defaultPrefix: 'WO-',   yearBased: true,  pad: 3 },
  purchase_order:   { table: 'purchase_orders',            column: 'po_number',         settingsKey: 'po_prefix',               defaultPrefix: 'PO-',   yearBased: true,  pad: 3 },
  journal_entry:    { table: 'journal_entries',            column: 'entry_number',      settingsKey: 'je_prefix',               defaultPrefix: 'JE-',   yearBased: false, pad: 4 },
  quotation:        { table: 'quotations',                 column: 'quotation_number',  settingsKey: 'quotation_number_prefix', defaultPrefix: 'QT-',   yearBased: false, pad: 5 },
  sales_order:      { table: 'sales_orders',               column: 'so_number',         settingsKey: 'so_number_prefix',        defaultPrefix: 'SO-',   yearBased: false, pad: 5 },
  sample:           { table: 'samples',                    column: 'sample_number',     settingsKey: 'sample_number_prefix',    defaultPrefix: 'SMP-',  yearBased: false, pad: 5 },
  shipment:         { table: 'shipments',                  column: 'shipment_number',   settingsKey: 'shipment_number_prefix',  defaultPrefix: 'SHP-',  yearBased: false, pad: 5 },
  sales_return:     { table: 'sales_returns',              column: 'return_number',     settingsKey: 'sr_number_prefix',        defaultPrefix: 'SR-',   yearBased: false, pad: 4 },
  purchase_return:  { table: 'purchase_returns',           column: 'return_number',     settingsKey: 'pr_number_prefix',        defaultPrefix: 'PR-',   yearBased: false, pad: 4 },
  maintenance:      { table: 'maintenance_orders',         column: 'barcode',           settingsKey: 'mnt_prefix',              defaultPrefix: 'MNT-',  yearBased: false, pad: 4 },
  machine:          { table: 'machines',                   column: 'code',              settingsKey: 'mch_prefix',              defaultPrefix: 'MCH-',  yearBased: false, pad: 3 },
  customer:         { table: 'customers',                  column: 'code',              settingsKey: 'cust_prefix',             defaultPrefix: 'CUST-', yearBased: false, pad: 3 },
  employee:         { table: 'employees',                  column: 'emp_code',          settingsKey: 'emp_prefix',              defaultPrefix: 'EMP-',  yearBased: false, pad: 3 },
  fabric_batch:     { table: 'fabric_inventory_batches',   column: 'batch_code',        settingsKey: 'fb_prefix',               defaultPrefix: 'FB-',   yearBased: true,  pad: 4 },
  qc_inspection:    { table: 'qc_inspections',             column: 'inspection_number', settingsKey: 'qc_number_prefix',        defaultPrefix: 'QC-',   yearBased: false, pad: 4 },
  ncr:              { table: 'qc_ncr',                     column: 'ncr_number',        settingsKey: 'ncr_number_prefix',       defaultPrefix: 'NCR-',  yearBased: false, pad: 4 },
};

/**
 * Generate the next sequential number for an entity.
 * Safe to call both inside and outside transactions.
 *
 * @param {Object} db    - better-sqlite3 database instance
 * @param {string} entity - Entity key from ENTITY_CONFIGS
 * @returns {string} The next formatted number
 */
function generateNextNumber(db, entity) {
  const config = ENTITY_CONFIGS[entity];
  if (!config) throw new Error(`Unknown entity for number generation: ${entity}`);

  const table  = validateIdentifier(config.table);
  const column = validateIdentifier(config.column);

  // Read prefix from settings, fall back to default
  let prefix = config.defaultPrefix;
  if (config.settingsKey) {
    const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(config.settingsKey);
    if (row?.value) prefix = row.value;
  }

  if (config.yearBased) {
    const year = new Date().getFullYear();
    const pattern = `${prefix}${year}-%`;
    const last = db.prepare(`SELECT "${column}" FROM "${table}" WHERE "${column}" LIKE ? ORDER BY id DESC LIMIT 1`).get(pattern);
    if (!last) return `${prefix}${year}-${String(1).padStart(config.pad, '0')}`;
    const parts = last[column].split('-');
    const num = parseInt(parts[parts.length - 1], 10) || 0;
    return `${prefix}${year}-${String(num + 1).padStart(config.pad, '0')}`;
  } else {
    const last = db.prepare(`SELECT "${column}" FROM "${table}" ORDER BY id DESC LIMIT 1`).get();
    if (!last || !last[column]) return `${prefix}${String(1).padStart(config.pad, '0')}`;
    const trailingDigits = String(last[column]).match(/(\d+)$/);
    const num = trailingDigits ? parseInt(trailingDigits[1], 10) : 0;
    return `${prefix}${String(num + 1).padStart(config.pad, '0')}`;
  }
}

module.exports = { generateNextNumber, ENTITY_CONFIGS };
