import Papa from 'papaparse';

const REPORT_PATTERNS = {
  general_ledger: [
    ['date'],
    ['property', 'address'],
    ['description', 'memo'],
    ['money in', 'income', 'debit'],
    ['money out', 'expense', 'credit'],
  ],
  rent_roll: [
    ['unit', 'property'],
    ['tenant', 'resident'],
    ['lease start', 'move in'],
    ['rent', 'monthly rent', 'rent amount'],
  ],
  income_register: [
    ['tenant'],
    ['payment date', 'date'],
    ['amount'],
    ['payment type'],
  ],
  owner_expense_report: [
    ['vendor'],
    ['amount'],
    ['category'],
    ['property'],
  ],
  // AppFolio's Cash Flow Detail is a hierarchical report: indented section
  // headers with transaction rows beneath them and a single signed Amount.
  cash_flow_detail: [
    ['account name'],
    ['date'],
    ['amount'],
    ['property'],
  ],
  // Property Performance is a per-property snapshot — no dates, and the figures
  // live in per-account columns rather than a transaction amount.
  property_performance: [
    ['property address'],
    ['units'],
    ['management fee'],
  ],
};

// Which report to analyze when several are uploaded, best first. The General
// Ledger wins because it carries transaction detail every rule depends on; a
// Cash Flow Detail is second because it at least parses. Property Performance is
// a per-property summary with no transaction amounts, so it can never be primary.
export const REPORT_PREFERENCE = ['general_ledger', 'cash_flow_detail'];

export const REPORT_LABELS = {
  general_ledger: 'General Ledger',
  cash_flow_detail: 'Cash Flow Detail',
  property_performance: 'Property Performance',
  rent_roll: 'Rent Roll',
  income_register: 'Income Register',
  owner_expense_report: 'Owner Expense Report',
  // No entry for 'unknown' on purpose — callers fall back to the filename, which
  // identifies the file better than a generic phrase.
};

export function detectReportType(headers) {
  if (!headers?.length) return 'unknown';
  const normalized = headers.map(h => h.toLowerCase().trim());

  for (const [type, groups] of Object.entries(REPORT_PATTERNS)) {
    const allMatch = groups.every(group =>
      group.some(keyword => normalized.some(h => h.includes(keyword)))
    );
    if (allMatch) return type;
  }
  return 'unknown';
}

function extractDateRange(data, fields) {
  const dateField = fields?.find(f => /date|month/i.test(f));
  if (!dateField) return null;

  const dates = data
    .map(row => new Date(row[dateField]))
    .filter(d => !isNaN(d.getTime()))
    .sort((a, b) => a - b);

  if (!dates.length) return null;
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  return { start: fmt(dates[0]), end: fmt(dates[dates.length - 1]) };
}

function extractProperties(data, fields) {
  const propField = fields?.find(f => /property|address/i.test(f));
  if (!propField) return [];
  const unique = [...new Set(data.map(r => r[propField]?.trim()).filter(Boolean))];
  return unique;
}

// A file Beacon can't read at all, as opposed to one it reads but can't analyze.
export class UnsupportedFileError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedFileError';
  }
}

function describe(rows, headers, filename) {
  return {
    filename,
    data: rows,
    headers,
    rowCount: rows.length,
    reportType: detectReportType(headers),
    dateRange: extractDateRange(rows, headers),
    properties: extractProperties(rows, headers),
  };
}

// Excel exports carry the same columns as the CSV ones, so they go through the
// same pipeline once the sheet is read. The library is loaded on demand — it is
// large, and most uploads never need it.
async function parseSpreadsheet(file) {
  const XLSX = await import('xlsx');
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: false });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new UnsupportedFileError('That workbook has no sheets in it.');

  // raw:false formats cells the way they're displayed, so dates arrive as the
  // same strings the CSV export produces.
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { defval: '', raw: false });
  if (!rows.length) throw new UnsupportedFileError(`The first sheet ("${sheetName}") is empty.`);

  return describe(rows, Object.keys(rows[0]), file.name);
}

function parseDelimited(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        resolve(describe(results.data, results.meta.fields || [], file.name));
      },
      error: reject,
    });
  });
}

export function parseCSV(file) {
  const name = (file.name || '').toLowerCase();

  if (/\.(xlsx|xlsm|xls)$/.test(name)) return parseSpreadsheet(file);
  if (/\.(csv|tsv|txt)$/.test(name)) return parseDelimited(file);

  // Anything else would be read as text and silently produce nonsense rows.
  if (/\.pdf$/.test(name)) {
    return Promise.reject(new UnsupportedFileError(
      'Beacon reads spreadsheet exports — CSV or Excel. A PDF of the same report will work once you export it as CSV instead.'
    ));
  }
  return Promise.reject(new UnsupportedFileError(
    'Beacon reads CSV and Excel exports. Export this report as CSV or .xlsx and try again.'
  ));
}
