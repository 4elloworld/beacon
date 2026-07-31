import { Router } from 'express';
import { cleanRow } from '../lib/dataClean.js';
import { runAnomalyDetection } from '../lib/anomalyDetector.js';
import { parseAddress } from '../lib/addressParser.js';

const router = Router();

const fmtMoney = n => (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString();

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

  const cleaned = rows.map(cleanRow);
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
    const note = topFlag
      ? `${ratioPct}% expense ratio · ${topFlag.title.split('—').slice(1).join('—').trim() || 'flagged'}`
      : `${ratioPct}% expense ratio`;

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
    };
  }).sort((a, b) => b.ratio - a.ratio);

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
      sub: `${cleaned.length.toLocaleString()} rows detected across ${properties.length} ${properties.length === 1 ? 'property' : 'properties'}`,
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
      ? "No property names were found in this file. Beacon needs a column identifying the property for each row."
      : `Found ${properties.length} ${properties.length === 1 ? 'property' : 'properties'} but no readable amounts. Beacon needs per-transaction amounts — a Debit/Credit pair, or a single signed Amount column. Summary reports that put figures in per-account columns aren't supported yet.`;
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
