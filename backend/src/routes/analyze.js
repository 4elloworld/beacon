import { Router } from 'express';
import { cleanRow } from '../lib/dataClean.js';
import { runAnomalyDetection } from '../lib/anomalyDetector.js';
import { parseAddress } from '../lib/addressParser.js';

const router = Router();

router.post('/', async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'rows array is required' });
  }

  const cleaned = rows.map(cleanRow);

  // Extract unique properties
  const propertyNames = [...new Set(cleaned.map(r => r.property).filter(Boolean))];
  const properties = propertyNames.map((name, i) => ({
    id: i,
    ...parseAddress(name),
    fullAddress: name,
  }));

  // Group transactions by property
  const byProperty = {};
  for (const row of cleaned) {
    if (!row.property) continue;
    if (!byProperty[row.property]) byProperty[row.property] = [];
    byProperty[row.property].push(row);
  }

  // Compute per-property financials
  const propertyStats = properties.map(p => {
    const txns = byProperty[p.fullAddress] || [];
    const rent = txns.reduce((s, r) => s + r.amountIn, 0);
    const expenses = txns.reduce((s, r) => s + r.amountOut, 0);
    return { ...p, rent, expenses, ratio: rent > 0 ? expenses / rent : 0 };
  });

  // Portfolio totals
  const totalRent = propertyStats.reduce((s, p) => s + p.rent, 0);
  const totalExpenses = propertyStats.reduce((s, p) => s + p.expenses, 0);
  const propertiesOverBudget = propertyStats.filter(p => p.ratio > 1).length;

  const flags = runAnomalyDetection(cleaned, properties);

  res.json({
    propertyCount: properties.length,
    rowCount: cleaned.length,
    totalRent,
    totalExpenses,
    netPosition: totalRent - totalExpenses,
    propertiesOverBudget,
    expenseRatioFlag: propertiesOverBudget > 0,
    mgmtFeeFlag: flags.some(f => f.flag_type === 'late_mgmt_billing'),
    mgmtFeeProperties: flags.filter(f => f.flag_type === 'late_mgmt_billing').length,
    flagCount: flags.length,
    flags,
    properties: propertyStats,
  });
});

export default router;
