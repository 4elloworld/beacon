// Hardcoded demo dataset matching the approved prototype. Used when no real CSV is uploaded.

export const DEMO_PROPERTIES = [
  { id: 0, num: '1847', street: 'Maple Ridge Drive',    city: 'Austin, TX',      rent: 38400,  exp: 60672,  late: 0,  status: 'red',   note: '158% expense ratio · $15,840 unnamed repairs' },
  { id: 1, num: '324',  street: 'Birchwood Lane',       city: 'Dallas, TX',      rent: 26400,  exp: 28776,  late: 11, status: 'red',   note: '109% expense ratio · chronic late payer' },
  { id: 2, num: '912',  street: 'Thornwood Circle',     city: 'Houston, TX',     rent: 31200,  exp: 34320,  late: 0,  status: 'red',   note: '110% expense ratio · 6 months vacant' },
  { id: 3, num: '2201', street: 'Cedar Hollow Court',   city: 'San Antonio, TX', rent: 28800,  exp: 30528,  late: 0,  status: 'amber', note: '106% expense ratio · duplicate mgmt fees' },
  { id: 4, num: '763',  street: 'Ridgemont Way',        city: 'Austin, TX',      rent: 33600,  exp: 34272,  late: 0,  status: 'amber', note: '102% expense ratio · bookkeeping anomaly' },
  { id: 5, num: '558',  street: 'Stonegate Terrace',    city: 'Dallas, TX',      rent: 29040,  exp: 26252,  late: 0,  status: 'green', note: '90% expense ratio · best performing' },
];

export const DEMO_FLAGS = [
  { sev: 'red',   title: 'Maple Ridge — $15,840 in repairs, zero vendor names on any charge',       sub: '$1,000 charge appears twice (Feb 10 + Feb 13). Four charges on one day (Jan 25). No receipts on any of 22 charges.' },
  { sev: 'red',   title: 'Thornwood Circle — 6 months vacant, Jan–Jun 2024',                        sub: '~$19,200 in lost rent at $3,200/mo. No explanation in the data. Was it being marketed?' },
  { sev: 'red',   title: 'Birchwood Lane — 11 late fees + 2 NSF over 8 months',                     sub: 'Aug, Oct, Nov 2024 · Jan, Feb, Apr 2025. Chronic pattern. Lease renewal decision is worth making now.' },
  { sev: 'amber', title: 'Ridgemont Way — $13,240 anomaly recorded as money out',                   sub: 'Transaction description implies income but recorded as outflow. Worth a written clarification request.' },
  { sev: 'amber', title: 'Management fees billed 3–4 months late across 3 properties',              sub: 'Cedar Hollow: Jan–Apr 2025 all billed Apr 8. Maple Ridge: Jan–Apr 2024 all billed Apr 19.' },
  { sev: 'amber', title: 'Duplicate management fees — Cedar Hollow and Stonegate, May 2024',        sub: 'Same property, same month, same amount charged twice.' },
  { sev: 'amber', title: '$4,200 in "Commissions" — no breakdown or purpose stated',                sub: 'Maple Ridge $2,400 Mar 2024 · Birchwood $1,800 Jun 2024.' },
];

export const DEMO_KPIS = {
  rentCollected:    187440,
  totalExpenses:    214820,
  netPosition:      -27380,
  ownerContributed: 8200,
  flagCount:        7,
  dateRange:        'Jan 2024 – Apr 2025',
  propertyCount:    6,
  baseExpenseRatio: 115, // totalExpenses / rentCollected * 100, rounded
};

export const DEMO_SCAN_STEPS = [
  { ico: 'GL', label: 'Reading transaction data',           sub: '842 rows detected across 6 properties',                              type: 'ok'   },
  { ico: 'AD', label: 'Mapping property addresses',         sub: '6 unique properties identified',                                     type: 'ok'   },
  { ico: '%',  label: 'Calculating expense ratios',         sub: '5 of 6 properties above 100% — expenses exceed rent',                type: 'flag' },
  { ico: '!',  label: 'Scanning for anomalies',             sub: '7 flags detected — duplicates, missing vendors, late billing',       type: 'flag' },
  { ico: '$',  label: 'Analyzing management fees',          sub: 'Billing irregularities on 3 properties',                            type: 'warn' },
  { ico: '?',  label: 'Checking for missing cost signals',  sub: 'Insurance, property taxes, mortgage not present',                   type: 'warn' },
  { ico: '✓',  label: 'Analysis complete',                  sub: 'Your dashboard is ready — the story is clear',                      type: 'ok'   },
];

export const DEMO_ACTIONS = [
  { title: 'Investigate the Ridgemont Way bookkeeping anomaly',    sub: '$13,240 recorded as money out — may be an error. Request written clarification.',  high: true  },
  { title: 'Find out why Thornwood Circle sat vacant 6 months',    sub: '~$19,200 in lost rent. Was it being marketed? Was there a habitability issue?',     high: true  },
  { title: 'Evaluate whether Maple Ridge Drive should be sold',    sub: '158% expense ratio, 3 cash injections, $15K+ repairs. Run the hold vs sell numbers.', high: true },
  { title: 'Set up monthly CSV exports for automatic updates',     sub: 'Request scheduled exports from your PM — one email, one CSV, dashboard stays current.', high: false },
  { title: 'Build a capital reserve fund starting now',            sub: '$8,200 in personal cash injected this period. A 5% monthly reserve prevents this permanently.', high: false },
  { title: 'Get receipts and vendor invoices for all unnamed repairs', sub: 'Not just Maple Ridge — any unlabeled repair across all 6 properties needs documentation.', high: false },
];
