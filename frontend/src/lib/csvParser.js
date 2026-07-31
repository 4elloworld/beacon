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
  cash_flow_detail: [
    ['month'],
    ['income'],
    ['expenses', 'expense'],
    ['net'],
  ],
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

export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(results) {
        const headers = results.meta.fields || [];
        const reportType = detectReportType(headers);
        const dateRange = extractDateRange(results.data, headers);
        const properties = extractProperties(results.data, headers);

        resolve({
          filename: file.name,
          data: results.data,
          headers,
          rowCount: results.data.length,
          reportType,
          dateRange,
          properties,
        });
      },
      error: reject,
    });
  });
}
