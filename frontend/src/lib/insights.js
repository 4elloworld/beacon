// Turns a backend analysis result into the narrative blocks the Key Takeaways
// and Your Move screens render. Returns null when there is no real analysis,
// so those screens fall back to their scripted demo copy.

const money = n => '$' + Math.round(Math.abs(n)).toLocaleString();

const COST_LABEL_WORDS = {
  property_tax: 'property taxes',
  insurance: 'landlord insurance',
  mortgage: 'mortgage / debt service',
  landscaping: 'lawn & landscaping',
  reserves: 'capital reserves',
};

function countByType(flags, type) {
  return flags.filter(f => f.flag_type === type).length;
}

export function buildInsights(analysis, costs = null) {
  if (!analysis?.isRealData || !analysis.properties?.length) return null;

  const { properties, flags = [], propertyCount, totalRent, totalExpenses, baseExpenseRatio } = analysis;
  const loss = properties.filter(p => p.exp > p.rent);
  const worst = properties[0];
  const dupes = countByType(flags, 'duplicate_charge');
  const vacancies = flags.filter(f => f.flag_type === 'vacancy');
  const lateFlags = flags.filter(f => f.flag_type === 'late_fee_pattern');
  const noVendor = flags.filter(f => f.flag_type === 'missing_vendor');
  const splitting = countByType(flags, 'invoice_splitting');
  const plural = n => (n === 1 ? 'property' : 'properties');
  const has = n => (n === 1 ? 'has' : 'have');

  const callouts = [];

  if (loss.length > 0) {
    callouts.push({
      type: 'red', icon: '⚠',
      lead: `${loss.length} of ${propertyCount} ${plural(propertyCount)} ${loss.length === 1 ? 'is' : 'are'} running at a loss.`,
      rest: worst && worst.rent > 0
        ? ` The worst is spending $${(worst.exp / worst.rent).toFixed(2)} for every $1.00 collected. Across the portfolio you are at a ${baseExpenseRatio}% expense ratio on ${money(totalRent)} of rent.`
        : ` Across the portfolio you are at a ${baseExpenseRatio}% expense ratio.`,
    });
  } else {
    callouts.push({
      type: 'green', icon: '✓',
      lead: `Every property is cash-flow positive.`,
      rest: ` The portfolio is running at a ${baseExpenseRatio}% expense ratio on ${money(totalRent)} of rent collected, keeping ${money(totalRent - totalExpenses)} as net.`,
    });
  }

  if (dupes > 0 || splitting > 0) {
    const bits = [];
    if (dupes > 0) bits.push(`${dupes} possible duplicate charge${dupes === 1 ? '' : 's'}`);
    if (splitting > 0) bits.push(`${splitting} ${splitting === 1 ? 'day' : 'days'} where one bill was split across several line items`);
    callouts.push({
      type: 'red', icon: '⚠',
      lead: `Charges that need verification.`,
      rest: ` We found ${bits.join(' and ')}. These are the places where money most often leaks without anyone noticing.`,
    });
  }

  if (noVendor.length > 0) {
    callouts.push({
      type: 'red', icon: '⚠',
      lead: `Expenses recorded with no vendor name.`,
      rest: ` ${noVendor.length} ${plural(noVendor.length)} ${has(noVendor.length)} generic charges like "Repairs" with nobody named against them. Unnamed charges cannot be verified after the fact.`,
    });
  }

  if (vacancies.length > 0) {
    callouts.push({
      type: 'amber', icon: '!',
      lead: `${vacancies.length} ${plural(vacancies.length)} went 2+ months with no rent.`,
      rest: ` Every vacant month is rent you will never bill for. Worth asking what marketing happened during those gaps.`,
    });
  }

  if (lateFlags.length > 0) {
    callouts.push({
      type: 'amber', icon: '!',
      lead: `Chronic late payment on ${lateFlags.length} ${plural(lateFlags.length)}.`,
      rest: ` Repeated late fees and NSF charges are a pattern, not bad luck. Those lease renewal decisions are worth making deliberately.`,
    });
  }

  // Only claim the picture is incomplete if it still is — the owner may have
  // already supplied these on the dashboard.
  if (costs?.total > 0) {
    const trueRatio = totalRent > 0
      ? Math.round(((totalExpenses + costs.total) / totalRent) * 100)
      : null;
    callouts.push({
      type: 'amber', icon: '!',
      lead: `You've added ${money(costs.total)} of costs the export didn't carry.`,
      rest: trueRatio
        ? ` That moves your expense ratio from ${baseExpenseRatio}% to ${trueRatio}% — the truer picture of what this portfolio costs to run.`
        : ` Your dashboard now reflects them.`,
    });
  } else {
    callouts.push({
      type: 'amber', icon: '!',
      lead: `Your picture is still incomplete.`,
      rest: ` Property taxes, insurance, and mortgage are not in this export. Add them on the dashboard to see your true expense ratio.`,
    });
  }

  callouts.push({
    type: 'green', icon: '✓',
    lead: `You found this now.`,
    rest: ` Not next April. The same data that surfaced these ${flags.length} flag${flags.length === 1 ? '' : 's'} now guides what to do next.`,
  });

  // Highest-impact actions, most urgent first.
  const rocks = [];

  if (noVendor.length > 0 || dupes > 0) {
    rocks.push({
      cls: 'r1',
      priority: { kind: 'red', text: 'Most urgent' },
      title: 'Request itemized receipts for unverifiable charges',
      body: `${dupes > 0 ? `${dupes} possible duplicate charge${dupes === 1 ? '' : 's'}. ` : ''}${noVendor.length > 0 ? `${noVendor.length} ${plural(noVendor.length)} with charges that name no vendor. ` : ''}A written request for itemized receipts gives your property manager the chance to document these — and often recovers money already paid.`,
      primaryBtn: 'Draft request letter →',
      secondaryBtn: 'See total at risk',
    });
  }

  if (vacancies.length > 0) {
    rocks.push({
      cls: 'r2',
      priority: { kind: 'red', text: 'Most urgent' },
      title: `Get an occupancy answer on ${vacancies.length} ${plural(vacancies.length)}`,
      body: `${vacancies[0].title.split('—').slice(1).join('—').trim()}. Ask what was done to market the unit during the gap, and what the current plan is. Vacancy is the single largest recoverable loss in most portfolios.`,
      primaryBtn: 'Draft occupancy request →',
      secondaryBtn: 'See lost rent',
    });
  }

  if (lateFlags.length > 0) {
    rocks.push({
      cls: 'r2',
      priority: { kind: 'amber', text: 'This month' },
      title: 'Decide on the chronic late-payer lease renewals',
      body: `${lateFlags.length} ${plural(lateFlags.length)} ${lateFlags.length === 1 ? 'shows' : 'show'} repeated late fees or NSF charges. That is a pattern worth deciding on before renewal paperwork gets signed — another year carries the same risk profile.`,
      primaryBtn: 'Assess tenant risk →',
      secondaryBtn: 'Know your options',
    });
  }

  // Only ask for costs that haven't been supplied yet.
  if (!costs || costs.total === 0) {
    rocks.push({
      cls: 'r3',
      priority: { kind: 'blue', text: 'This quarter' },
      title: 'Build your true cost picture',
      body: `Your dashboard reflects this export only. Property taxes, landlord insurance, and capital reserves are real costs not captured here. On ${propertyCount} ${plural(propertyCount)} these can add tens of thousands per year. Until you see that number you cannot make a confident hold, sell, or refinance decision.`,
      primaryBtn: 'Add my costs →',
      secondaryBtn: 'See estimates',
    });
  } else if (costs.missing?.length) {
    const remaining = costs.missing.map(t => COST_LABEL_WORDS[t] || t);
    rocks.push({
      cls: 'r3',
      priority: { kind: 'blue', text: 'This quarter' },
      title: 'Finish your true cost picture',
      body: `You've added ${money(costs.total)} in costs the export didn't carry. Still outstanding: ${remaining.join(', ')}. Filling ${remaining.length === 1 ? 'that' : 'those'} in completes the number you need for a confident hold, sell, or refinance decision.`,
      primaryBtn: 'Add remaining costs →',
      secondaryBtn: 'See estimates',
    });
  }

  // Follow-up checklist, drawn from the specific properties in this portfolio.
  const actions = [];
  const name = p => [p.num, p.street].filter(Boolean).join(' ') || p.fullAddress;

  for (const v of vacancies.slice(0, 2)) {
    const p = properties.find(x => x.fullAddress === v.property);
    actions.push({
      title: `Find out why ${p ? name(p) : 'this property'} had no rent coming in`,
      sub: v.detail,
      high: true,
    });
  }

  for (const p of loss.slice(0, 2)) {
    if (!p.rent) continue;
    actions.push({
      title: `Run hold-vs-sell numbers on ${name(p)}`,
      sub: `${Math.round(p.ratio * 100)}% expense ratio — ${money(p.exp)} spent against ${money(p.rent)} collected.`,
      high: true,
    });
  }

  for (const f of noVendor.slice(0, 1)) {
    const p = properties.find(x => x.fullAddress === f.property);
    actions.push({
      title: `Request vendor names for charges on ${p ? name(p) : 'flagged properties'}`,
      sub: f.sub || f.detail,
      high: true,
    });
  }

  actions.push({
    title: 'Set up monthly CSV exports for automatic updates',
    sub: 'Request scheduled exports from your property manager — one email, one CSV, and this dashboard stays current.',
    high: false,
  });
  actions.push({
    title: 'Build a capital reserve fund',
    sub: 'A 5% monthly reserve turns surprise repairs into a planned cost rather than a cash injection.',
    high: false,
  });
  if (!costs || costs.missing?.length) {
    actions.push({
      title: costs?.total
        ? 'Add the remaining costs to this dashboard'
        : 'Add taxes, insurance and debt service to this dashboard',
      sub: 'These are missing from the export. Until they are in, your expense ratio is understated.',
      high: false,
    });
  }

  return {
    callouts,
    rocks: rocks.slice(0, 3),
    actions: actions.slice(0, 7),
    flagCount: flags.length,
    propertyCount,
  };
}
