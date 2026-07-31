const CURRENCY_RE = /[$,]/g;

function parseMoney(val) {
  if (!val) return 0;
  return parseFloat(String(val).replace(CURRENCY_RE, '')) || 0;
}

function parseDate(str) {
  if (!str) return null;
  // MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? '20' + mdy[3] : mdy[3];
    return new Date(`${year}-${mdy[1].padStart(2,'0')}-${mdy[2].padStart(2,'0')}`);
  }
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

// Normalize address for grouping: trim, title-case, strip unit/suite suffixes
function normalizeAddress(addr) {
  return toTitleCase(addr.trim()).replace(/\s+(Apt|Unit|Suite|Ste|#)\s*\S+$/i, '').trim();
}

export function cleanRow(row) {
  // Detect column names flexibly
  const keys = Object.keys(row);
  const find = (...patterns) => keys.find(k => patterns.some(p => k.toLowerCase().includes(p)));

  const dateKey = find('date');
  const propKey = find('property', 'address');
  const descKey = find('description', 'memo');
  const inKey   = find('money in', 'income', 'debit', 'amount in');
  const outKey  = find('money out', 'expense', 'credit', 'amount out');
  const vendKey = find('vendor', 'payee');

  return {
    date:        dateKey  ? parseDate(row[dateKey])              : null,
    property:    propKey  ? normalizeAddress(row[propKey] || '') : '',
    description: descKey  ? String(row[descKey] || '').trim()   : '',
    amountIn:    inKey    ? parseMoney(row[inKey])               : 0,
    amountOut:   outKey   ? parseMoney(row[outKey])              : 0,
    vendorName:  vendKey  ? String(row[vendKey] || '').trim()    : '',
    raw: row,
  };
}
