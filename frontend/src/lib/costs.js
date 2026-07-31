// Costs the owner adds by hand on the Dashboard. Shared so every screen agrees
// on what has been supplied — a screen that doesn't know about them will tell
// the owner their picture is incomplete right after they completed it.

// Per-property annual estimates, scaled to the portfolio actually loaded.
const PER_PROPERTY = {
  property_tax: 5333,
  insurance:    2000,
  mortgage:     0,     // no estimate — must be entered manually
  landscaping:  1500,
};

// Reserves are conventionally a share of rent rather than a per-door figure.
const RESERVE_RATE = 0.05;

export const COST_LABELS = {
  property_tax: 'taxes',
  insurance: 'insurance',
  mortgage: 'mortgage',
  landscaping: 'landscaping',
  reserves: 'reserves',
};

export function estimatesFor(propertyCount, rentCollected) {
  const n = Math.max(propertyCount || 1, 1);
  return {
    property_tax: PER_PROPERTY.property_tax * n,
    insurance:    PER_PROPERTY.insurance * n,
    mortgage:     0,
    landscaping:  PER_PROPERTY.landscaping * n,
    reserves:     Math.round((rentCollected || 0) * RESERVE_RATE),
  };
}

export function computeAddedCosts(costState, estimates) {
  let total = 0;
  const addedTypes = [];
  for (const [type, state] of Object.entries(costState || {})) {
    let amt = 0;
    if (state.mode === 'manual' && state.value) {
      amt = parseFloat(state.value) || 0;
    } else if (state.mode === 'est') {
      amt = estimates[type] || 0;
    }
    if (amt > 0) { total += amt; addedTypes.push(type); }
  }
  return { total, addedTypes };
}

const shortMoney = n => (n >= 1000 ? `$${Math.round(n / 1000)}K` : `$${Math.round(n)}`);

export function costItemsFor(est) {
  return [
    { type: 'property_tax', label: 'Property taxes',          impact: `~${shortMoney(est.property_tax)}/yr est.`, hasEstimate: true },
    { type: 'insurance',    label: 'Landlord insurance',      impact: `~${shortMoney(est.insurance)}/yr est.`,    hasEstimate: true },
    { type: 'mortgage',     label: 'Mortgage / debt service', impact: 'varies',                                    hasEstimate: false },
    { type: 'landscaping',  label: 'Lawn & landscaping',      impact: `~${shortMoney(est.landscaping)}/yr est.`,  hasEstimate: true },
    { type: 'reserves',     label: 'Capital reserves (5%)',   impact: `~${shortMoney(est.reserves)}/yr est.`,     hasEstimate: true },
  ];
}

// Which cost types the owner has explicitly marked as not applicable or supplied.
export function costsSummary(costState, propertyCount, rentCollected) {
  const estimates = estimatesFor(propertyCount, rentCollected);
  const { total, addedTypes } = computeAddedCosts(costState, estimates);
  const missing = Object.keys(COST_LABELS).filter(t => {
    const mode = costState?.[t]?.mode;
    return mode === 'pending';
  });
  return { total, addedTypes, missing, estimates };
}
