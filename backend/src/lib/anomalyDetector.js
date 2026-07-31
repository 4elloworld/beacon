// Anomaly detection rules. Operates on rows already normalized by cleanRow().

function monthKey(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function dayKey(date) {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function nextMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function fmtMonth(mk) {
  const [y, m] = mk.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// A repeated charge below this isn't worth an owner's attention as a critical
// finding; smaller ones are aggregated into a single review note instead.
const DUPLICATE_MATERIALITY = 100;

const GENERIC_DESCRIPTIONS = ['repairs', 'maintenance', 'work order', 'misc', 'general'];

export function runAnomalyDetection(rows) {
  const flags = [];

  const byProperty = {};
  for (const r of rows) {
    if (!r.property) continue;
    (byProperty[r.property] ||= []).push(r);
  }

  for (const [property, txns] of Object.entries(byProperty)) {
    const expenses = txns.filter(t => t.amountOut > 0);
    const label = property.replace(/,?\s*[A-Z]{2}\s*\d{5}$/, '');

    // 1. Duplicate charge: the same description and amount billed twice in one
    // month. A charge that recurs at the same amount across several months is a
    // standing item — rent, an escrow line, a recurring fee — not a duplicate,
    // so only charges confined to a single month are considered.
    const monthsSeen = {};
    for (const t of expenses) {
      if (!t.description) continue;
      const id = `${t.description.toLowerCase()}|${t.amountOut}`;
      (monthsSeen[id] ||= new Set()).add(monthKey(t.date));
    }

    const seen = {};
    const dupsReported = new Set();
    const smallDupes = [];
    for (const t of expenses) {
      if (!t.description) continue;
      const id = `${t.description.toLowerCase()}|${t.amountOut}`;
      if (monthsSeen[id].size > 1) continue; // recurs monthly — expected, not a duplicate

      const key = `${id}|${monthKey(t.date)}`;
      if (seen[key] && !dupsReported.has(key)) {
        dupsReported.add(key);

        // A repeated charge for pocket change is not something to call critical.
        // Those are collected and reported once, so nothing is hidden but the
        // list stays worth reading.
        if (t.amountOut < DUPLICATE_MATERIALITY) {
          smallDupes.push(t);
        } else {
          flags.push({
            flag_type: 'duplicate_charge',
            severity: 'critical',
            property,
            title: `${label} — possible duplicate charge`,
            detail: `"${t.description}" for $${t.amountOut.toLocaleString()} appears more than once in ${fmtMonth(monthKey(t.date))}, and not in any other month.`,
          });
        }
      }
      seen[key] = true;
    }

    if (smallDupes.length >= 2) {
      const total = smallDupes.reduce((s, t) => s + t.amountOut, 0);
      flags.push({
        flag_type: 'duplicate_charge_minor',
        severity: 'review',
        property,
        title: `${label} — ${smallDupes.length} small charges billed twice in the same month`,
        detail: `${total.toLocaleString(undefined, { style: 'currency', currency: 'USD' })} in total, each under ${DUPLICATE_MATERIALITY.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}. Worth a glance rather than a query.`,
      });
    }

    // 2. Invoice splitting: several separate expense charges on one day.
    // Management-fee batches are handled by rule 6, so exclude them here to avoid double-flagging.
    const byDay = {};
    for (const t of expenses) {
      if (/management fee|mgmt fee/i.test(t.description)) continue;
      const dk = dayKey(t.date);
      if (!dk) continue;
      (byDay[dk] ||= []).push(t);
    }
    for (const [day, dayTxns] of Object.entries(byDay)) {
      const total = dayTxns.reduce((s, t) => s + t.amountOut, 0);
      if (dayTxns.length >= 4 && total >= 1000) {
        flags.push({
          flag_type: 'invoice_splitting',
          severity: 'review',
          property,
          title: `${label} — ${dayTxns.length} separate charges on ${day}`,
          detail: `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} split across ${dayTxns.length} line items on a single day.`,
        });
      }
    }

    // 3. Generic expense descriptions with no vendor recorded.
    const noVendor = expenses.filter(t =>
      !t.vendorName &&
      GENERIC_DESCRIPTIONS.some(g => t.description.toLowerCase().includes(g))
    );
    if (noVendor.length >= 3) {
      const total = noVendor.reduce((s, t) => s + t.amountOut, 0);
      flags.push({
        flag_type: 'missing_vendor',
        severity: 'review',
        property,
        title: `${label} — ${noVendor.length} charges with no vendor name`,
        detail: `$${total.toLocaleString(undefined, { maximumFractionDigits: 0 })} in expenses have generic descriptions and no vendor recorded.`,
      });
    }

    // 4. Vacancy: a gap of 2+ months with no rent income.
    const rentByMonth = {};
    for (const t of txns) {
      if (t.amountIn <= 0 || !t.date) continue;
      const mk = monthKey(t.date);
      rentByMonth[mk] = (rentByMonth[mk] || 0) + t.amountIn;
    }
    const months = Object.keys(rentByMonth).sort();
    for (let i = 1; i < months.length; i++) {
      const expected = nextMonth(months[i - 1]);
      if (months[i] === expected) continue;
      let gap = 0;
      let cur = expected;
      while (cur < months[i] && gap < 60) { gap++; cur = nextMonth(cur); }
      if (gap >= 2) {
        const avg = Object.values(rentByMonth).reduce((s, v) => s + v, 0) / months.length;
        flags.push({
          flag_type: 'vacancy',
          severity: 'critical',
          property,
          title: `${label} — ${gap} months with no rent, ${fmtMonth(expected)}–${fmtMonth(months[i])}`,
          detail: `~$${Math.round(avg * gap).toLocaleString()} in potential lost rent at the property's average of $${Math.round(avg).toLocaleString()}/mo.`,
        });
        break;
      }
    }

    // 5. Chronic late payer.
    const lateFees = txns.filter(t => /late fee|nsf|bounced/i.test(t.description + ' ' + t.glAccount));
    if (lateFees.length >= 3) {
      flags.push({
        flag_type: 'late_fee_pattern',
        severity: 'critical',
        property,
        title: `${label} — ${lateFees.length} late fees / NSF charges`,
        detail: `Chronic late payment pattern. Worth a lease renewal decision.`,
      });
    }

    // 6. Management fees batched: many fee lines on one date, well above this
    // property's own typical daily count. Per-payment fee splitting is normal in
    // AppFolio, so only an outlier day is worth surfacing — and only once.
    const mgmtByDay = {};
    for (const t of expenses) {
      if (!/management fee|mgmt fee/i.test(t.description + ' ' + t.glAccount)) continue;
      const dk = dayKey(t.date);
      if (!dk) continue;
      (mgmtByDay[dk] ||= []).push(t);
    }
    const mgmtDays = Object.entries(mgmtByDay);
    if (mgmtDays.length >= 2) {
      const counts = mgmtDays.map(([, v]) => v.length);
      const median = counts.slice().sort((a, b) => a - b)[Math.floor(counts.length / 2)];
      const worst = mgmtDays.reduce((a, b) => (b[1].length > a[1].length ? b : a));
      if (worst[1].length >= 6 && worst[1].length >= median * 3) {
        flags.push({
          flag_type: 'late_mgmt_billing',
          severity: 'review',
          property,
          title: `${label} — ${worst[1].length} management fees billed on ${worst[0]}`,
          detail: `Typical is ${median} per billing day here. Several periods appear to have been billed at once.`,
        });
      }
    }

    // 7. Repair charges concentrated on round numbers.
    const repairs = expenses.filter(t => /repair|maintenance|work order|r&m/i.test(t.description + ' ' + t.glAccount));
    if (repairs.length >= 5) {
      const round = repairs.filter(t => t.amountOut % 50 === 0).length;
      if (round / repairs.length >= 0.7) {
        flags.push({
          flag_type: 'round_numbers',
          severity: 'review',
          property,
          title: `${label} — repair charges are mostly round numbers`,
          detail: `${round} of ${repairs.length} repair charges are exact multiples of $50, which can indicate estimates recorded as actuals.`,
        });
      }
    }
  }

  const rank = { critical: 0, review: 1 };
  flags.sort((a, b) => rank[a.severity] - rank[b.severity]);
  return flags;
}
