import { Router } from 'express';
import { cleanRow } from '../lib/dataClean.js';
import { runAnomalyDetection } from '../lib/anomalyDetector.js';
import { parseAddress } from '../lib/addressParser.js';

const router = Router();

const fmtMoney = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

// Labels a ledger uses for structure rather than for a property.
const LEDGER_MARKERS = /^(->|starting balance|ending balance|net change|beginning balance|total\b|subtotal\b|grand total\b)/i;

// How much a property warrants the owner's attention, used to decide which ones
// lead the list. Ratio alone is a poor guide: on a healthy portfolio the highest
// ratios can be unremarkable while the real story — a property empty for months,
// a chronic late payer — sits further down.
const NOTABILITY_WEIGHTS = {
  vacancy:           60,  // months of rent that will never be billed
  late_fee_pattern:  35,
  duplicate_charge:  30,
  missing_vendor:    20,
  invoice_splitting: 12,
  late_mgmt_billing:  8,
  duplicate_charge_minor: 3,
};

function notabilityOf(ratio, flags) {
  let score = flags.reduce((s, f) => s + (NOTABILITY_WEIGHTS[f.flag_type] ?? 5), 0);
  if (ratio > 1) score += 50;                       // spending more than it earns
  else if (ratio > 0.85) score += 15;               // close to it
  score += Math.min(ratio, 3) * 10;                 // rewards genuine extremes, capped
  return score;
}

function isTransaction(row) {
  // Every real transaction is dated; section headers and totals are not.
  if (!row.date) return false;
  if (!row.property) return false;
  if (LEDGER_MARKERS.test(row.property.trim())) return false;
  return true;
}

function fmtRange(dates) {
  if (!dates.length) return '';
  const f = d => d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const first = f(dates[0]);
  const last = f(dates[dates.length - 1]);
  return first === last ? first : `${first} – ${last}`;
}

router.post('/', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array is required' });
  }

  // A ledger export interleaves section headers and running totals with the
  // transactions — "-> 1050-00 - Operating Account", "Starting Balance",
  // "Net Change". They have no date, and their balance figures are not income.
  // Counted as rows they invent properties and inflate every total, so drop them.
  const cleaned = rows.map(cleanRow).filter(isTransaction);
  const skippedRows = rows.length - cleaned.length;
  const flags = runAnomalyDetection(cleaned);

  const byProperty = {};
  for (const row of cleaned) {
    if (!row.property) continue;
    (byProperty[row.property] ||= []).push(row);
  }

  const flagsByProperty = {};
  for (const f of flags) (flagsByProperty[f.property] ||= []).push(f);

  const properties = Object.keys(byProperty).map((fullAddress, i) => {
    const txns = byProperty[fullAddress];
    const rent = txns.reduce((s, r) => s + r.amountIn, 0);
    const exp = txns.reduce((s, r) => s + r.amountOut, 0);
    const ratio = rent > 0 ? exp / rent : 0;
    const pFlags = flagsByProperty[fullAddress] || [];
    const late = txns.filter(t => /late fee|nsf/i.test(t.description + ' ' + t.glAccount)).length;

    // Prefer the export's own street/city columns over parsing the combined label.
    const withStreet = txns.find(t => t.streetLine);
    const withCity = txns.find(t => t.city);
    const parsed = parseAddress(withStreet ? withStreet.streetLine : fullAddress);
    const address = {
      ...parsed,
      city: withCity ? withCity.city : parsed.city,
    };

    const status = ratio > 1 ? 'red' : ratio > 0.85 ? 'amber' : 'green';
    const ratioPct = Math.round(ratio * 100);
    const topFlag = pFlags[0];
    // The card already prints the ratio on its own line — the note carries only
    // the reason, so the two don't read as a stutter.
    const note = topFlag
      ? (topFlag.title.split('—').slice(1).join('—').trim() || 'flagged for review')
      : '';

    return {
      id: i,
      ...address,
      fullAddress,
      rent,
      exp,
      expenses: exp,
      ratio,
      status,
      note,
      late,
      flagCount: pFlags.length,
      criticalCount: pFlags.filter(f => f.severity === 'critical').length,
      notability: notabilityOf(ratio, pFlags),
    };
  }).sort((a, b) => b.notability - a.notability || b.ratio - a.ratio);

  properties.forEach((p, i) => { p.id = i; });

  const totalRent = properties.reduce((s, p) => s + p.rent, 0);
  const totalExpenses = properties.reduce((s, p) => s + p.exp, 0);
  const propertiesOverBudget = properties.filter(p => p.ratio > 1).length;

  const dates = cleaned.map(r => r.date).filter(Boolean).sort((a, b) => a - b);
  const dateRange = fmtRange(dates);
  const baseExpenseRatio = totalRent > 0 ? Math.round((totalExpenses / totalRent) * 100) : 0;

  const critical = flags.filter(f => f.severity === 'critical').length;
  const vacancies = flags.filter(f => f.flag_type === 'vacancy').length;
  const mgmtFlags = flags.filter(f => f.flag_type === 'late_mgmt_billing');

  const scanSteps = [
    {
      ico: '✓', type: 'ok', label: 'Reading transaction data',
      // Account for every row that came in — a reader who totals the uploaded
      // row counts should be able to reconcile them against this number.
      sub: `${cleaned.length.toLocaleString()} transactions across ${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`
        + (skippedRows > 0
            ? ` · ${skippedRows.toLocaleString()} account headers and totals skipped`
            : ''),
    },
    {
      ico: '✓', type: 'ok', label: 'Mapping property addresses',
      sub: `${properties.length} unique ${properties.length === 1 ? 'property' : 'properties'} identified${dateRange ? ` · ${dateRange}` : ''}`,
    },
    {
      ico: propertiesOverBudget > 0 ? '!' : '✓',
      type: propertiesOverBudget > 0 ? 'warn' : 'ok',
      label: 'Calculating expense ratios',
      sub: propertiesOverBudget > 0
        ? `${propertiesOverBudget} of ${properties.length} above 100% — expenses exceed rent`
        : `Portfolio running at ${baseExpenseRatio}% expense ratio`,
    },
    {
      ico: flags.length > 0 ? '!' : '✓',
      type: flags.length > 0 ? 'warn' : 'ok',
      label: 'Scanning for anomalies',
      sub: flags.length > 0
        ? `${flags.length} flag${flags.length === 1 ? '' : 's'} detected — ${critical} critical`
        : 'No anomalies detected',
    },
    {
      ico: vacancies > 0 ? '!' : '✓',
      type: vacancies > 0 ? 'warn' : 'ok',
      label: 'Checking occupancy gaps',
      sub: vacancies > 0
        ? `${vacancies} propert${vacancies === 1 ? 'y' : 'ies'} with 2+ months of no rent`
        : 'No extended vacancy gaps found',
    },
    {
      ico: '✓', type: 'ok', label: 'Analysis complete',
      sub: `Net position ${fmtMoney(totalRent - totalExpenses)} across ${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`,
    },
  ];

  // Finding property names is not enough to call an export readable — a summary
  // report can yield rows of addresses with no parseable money in them, which
  // would otherwise render as a confident portfolio of zeroes. Require both.
  const hasMoney = totalRent > 0 || totalExpenses > 0;
  const readable = properties.length > 0 && hasMoney;

  let readError = null;
  if (!readable) {
    readError = properties.length === 0
      ? `No dated transactions were found in this file${rows.length ? ` (${rows.length.toLocaleString()} rows read)` : ''}. Beacon works from transaction rows — each needs a date and a property. Summary reports that total each property on one line aren't supported yet.`
      : `Found ${properties.length} ${properties.length === 1 ? 'property' : 'properties'} but no readable amounts. Beacon needs per-transaction amounts — a Debit/Credit pair, or a single signed Amount column.`;
  }

  res.json({
    // The UI falls back to the sample portfolio when this is false, and shows
    // readError so the person knows why rather than seeing zeroes as fact.
    isRealData: readable,
    readError,
    propertyCount: properties.length,
    rowCount: cleaned.length,
    dateRange,
    totalRent,
    totalExpenses,
    netPosition: totalRent - totalExpenses,
    baseExpenseRatio,
    propertiesOverBudget,
    expenseRatioFlag: propertiesOverBudget > 0,
    mgmtFeeFlag: mgmtFlags.length > 0,
    mgmtFeeProperties: mgmtFlags.length,
    flagCount: flags.length,
    criticalCount: critical,
    flags: flags.map(f => ({
      sev: f.severity === 'critical' ? 'red' : 'amber',
      severity: f.severity,
      flag_type: f.flag_type,
      property: f.property,
      title: f.title,
      sub: f.detail,
    })),
    properties,
    scanSteps,
  });
});

export default router;
