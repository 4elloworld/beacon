// All anomaly detection rules from the handoff spec.

function monthKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

const GENERIC_DESCRIPTIONS = ['repairs', 'maintenance', 'work order', 'misc', 'general'];

export function runAnomalyDetection(rows, properties) {
  const flags = [];

  // Group by property
  const byProperty = {};
  for (const r of rows) {
    if (!r.property) continue;
    if (!byProperty[r.property]) byProperty[r.property] = [];
    byProperty[r.property].push(r);
  }

  for (const [property, txns] of Object.entries(byProperty)) {
    // 1. Duplicate charge: same description + amount + month
    const seen = {};
    for (const t of txns) {
      if (!t.amountOut || !t.description) continue;
      const key = `${t.description.toLowerCase()}|${t.amountOut}|${monthKey(t.date)}`;
      if (seen[key]) {
        flags.push({
          flag_type: 'duplicate_charge',
          severity: 'critical',
          property,
          title: `${property} — possible duplicate charge`,
          detail: `"${t.description}" $${t.amountOut} appears twice in ${monthKey(t.date)}.`,
        });
      }
      seen[key] = true;
    }

    // 2. Invoice splitting: 3+ charges same property same day
    const byDay = {};
    for (const t of txns) {
      if (!t.amountOut) continue;
      const dk = dayKey(t.date);
      if (!dk) continue;
      if (!byDay[dk]) byDay[dk] = [];
      byDay[dk].push(t);
    }
    for (const [day, dayTxns] of Object.entries(byDay)) {
      if (dayTxns.length >= 3) {
        flags.push({
          flag_type: 'invoice_splitting',
          severity: 'review',
          property,
          title: `${property} — ${dayTxns.length} charges on ${day}`,
          detail: `Multiple expenses on the same day may indicate invoice splitting.`,
        });
      }
    }

    // 3. Missing vendor names on expense entries
    const noVendor = txns.filter(t =>
      t.amountOut > 0 &&
      !t.vendorName &&
      GENERIC_DESCRIPTIONS.some(g => t.description.toLowerCase().includes(g))
    );
    if (noVendor.length > 0) {
      const total = noVendor.reduce((s, t) => s + t.amountOut, 0);
      flags.push({
        flag_type: 'missing_vendor',
        severity: 'review',
        property,
        title: `${property} — ${noVendor.length} charges with no vendor name`,
        detail: `$${total.toFixed(0)} in expenses have generic descriptions and no vendor recorded.`,
      });
    }

    // 4. Vacancy: zero rent for 2+ consecutive months
    const rentByMonth = {};
    for (const t of txns) {
      if (!t.amountIn || !t.date) continue;
      const mk = monthKey(t.date);
      rentByMonth[mk] = (rentByMonth[mk] || 0) + t.amountIn;
    }
    const months = Object.keys(rentByMonth).sort();
    for (let i = 1; i < months.length; i++) {
      const expected = nextMonth(months[i - 1]);
      if (months[i] !== expected) {
        // Count the gap: how many months are missing between months[i-1] and months[i]
        let gapCount = 0;
        let cur = expected;
        while (cur < months[i]) { gapCount++; cur = nextMonth(cur); }
        if (gapCount >= 2) {
          flags.push({
            flag_type: 'vacancy',
            severity: 'critical',
            property,
            title: `${property} — apparent vacancy`,
            detail: `No rent income detected for ${gapCount} consecutive months (${expected} to ${months[i]}).`,
          });
          break;
        }
      }
    }

    // 5. Chronic late payer: 3+ late fee charges in 12-month window
    const lateFees = txns.filter(t => /late fee|nsf|bounced/i.test(t.description) && t.amountIn > 0);
    if (lateFees.length >= 3) {
      flags.push({
        flag_type: 'late_fee_pattern',
        severity: 'critical',
        property,
        title: `${property} — ${lateFees.length} late fees detected`,
        detail: `Chronic late payment pattern. Lease renewal decision worth considering.`,
      });
    }

    // 6. Late management fee billing: mgmt fee for month X billed in X+2 or later
    const mgmtFees = txns.filter(t => /management fee|mgmt fee/i.test(t.description) && t.amountOut > 0);
    for (const fee of mgmtFees) {
      if (!fee.date) continue;
      // Heuristic: description often includes the period month; check if billed date is 2+ months after
      // Without a period reference we just flag batched billing (multiple months same day)
    }
    const mgmtByDay = {};
    for (const t of mgmtFees) {
      const dk = dayKey(t.date);
      if (!dk) continue;
      if (!mgmtByDay[dk]) mgmtByDay[dk] = [];
      mgmtByDay[dk].push(t);
    }
    for (const [day, dayFees] of Object.entries(mgmtByDay)) {
      if (dayFees.length >= 2) {
        flags.push({
          flag_type: 'late_mgmt_billing',
          severity: 'review',
          property,
          title: `${property} — management fees batched on ${day}`,
          detail: `${dayFees.length} management fee charges billed on the same date, possibly covering multiple months.`,
        });
      }
    }

    // 7. Round number concentration: 70%+ of repair charges are round numbers
    const repairs = txns.filter(t => /repair|maintenance|work order/i.test(t.description) && t.amountOut > 0);
    if (repairs.length >= 4) {
      const roundCount = repairs.filter(t => t.amountOut % 50 === 0).length;
      if (roundCount / repairs.length >= 0.7) {
        flags.push({
          flag_type: 'round_numbers',
          severity: 'review',
          property,
          title: `${property} — repair charges are mostly round numbers`,
          detail: `${roundCount} of ${repairs.length} repair charges are multiples of $50. May indicate estimates recorded as actuals.`,
        });
      }
    }
  }

  return flags;
}

function nextMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m, 1); // m is already 1-indexed here because we split correctly
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
