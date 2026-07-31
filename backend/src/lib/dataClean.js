const CURRENCY_RE = /[$,]/g;

function parseMoney(val) {
  if (val === null || val === undefined) return 0;
  const s = String(val).replace(CURRENCY_RE, '').trim();
  if (!s) return 0;
  // Accounting negatives: (123.45)
  const paren = s.match(/^\((.*)\)$/);
  const n = parseFloat(paren ? paren[1] : s);
  if (isNaN(n)) return 0;
  return paren ? -n : n;
}

function parseDate(str) {
  if (!str) return null;
  const s = String(str).trim();
  // Construct in local time — the ISO string form would be parsed as UTC and can
  // shift the calendar day backwards for anyone west of Greenwich.
  const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mdy) {
    const year = Number(mdy[3].length === 2 ? '20' + mdy[3] : mdy[3]);
    return new Date(year, Number(mdy[1]) - 1, Number(mdy[2]));
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function normalizeAddress(addr) {
  return toTitleCase(String(addr).trim())
    .replace(/\s+(Apt|Unit|Suite|Ste|#)\s*\S+$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Leading digits of a GL account code determine its statement category.
// 1xxx asset, 2xxx liability, 3xxx equity, 4xxx income, 5xxx-7xxx expense.
function accountClass(glAccount) {
  const m = String(glAccount || '').trim().match(/^(\d)/);
  if (!m) return null;
  const lead = m[1];
  if (lead === '4') return 'income';
  if (lead === '5' || lead === '6' || lead === '7') return 'expense';
  if (lead === '1' || lead === '2' || lead === '3') return 'balance';
  return null;
}

export function cleanRow(row) {
  const keys = Object.keys(row);
  const find = (...patterns) => keys.find(k => patterns.some(p => k.toLowerCase().trim() === p))
    || keys.find(k => patterns.some(p => k.toLowerCase().includes(p)));

  const dateKey = find('date');
  const propKey = find('property address', 'property', 'address');
  const descKey = find('description', 'memo');
  const vendKey = find('payee / payer', 'vendor', 'payee');
  const glKey   = find('gl account', 'account name', 'account');
  const debitKey  = find('debit');
  const creditKey = find('credit');
  const amountKey = find('amount');
  const streetKey = find('property street address 1', 'street address 1', 'street address');
  const cityKey   = find('property city');
  const stateKey  = find('property state');

  const gl = glKey ? row[glKey] : '';
  const cls = accountClass(gl);

  let amountIn = 0;
  let amountOut = 0;

  if (debitKey && creditKey && cls) {
    // Double-entry ledger. Only the income/expense leg represents real activity;
    // the balance-sheet leg is the offsetting entry and would double-count.
    const debit = parseMoney(row[debitKey]);
    const credit = parseMoney(row[creditKey]);
    if (cls === 'income') {
      amountIn = credit - debit;      // debits against income are reversals
    } else if (cls === 'expense') {
      amountOut = debit - credit;
    }
  } else if (debitKey && creditKey) {
    // No account code to classify by — fall back to raw sides.
    amountIn = parseMoney(row[creditKey]);
    amountOut = parseMoney(row[debitKey]);
  } else if (amountKey) {
    const amt = parseMoney(row[amountKey]);
    if (amt >= 0) amountIn = amt; else amountOut = -amt;
  } else {
    const inKey = find('money in', 'income', 'amount in');
    const outKey = find('money out', 'expense', 'amount out');
    amountIn = inKey ? parseMoney(row[inKey]) : 0;
    amountOut = outKey ? parseMoney(row[outKey]) : 0;
  }

  const cityRaw = cityKey ? String(row[cityKey] || '').trim() : '';
  const stateRaw = stateKey ? String(row[stateKey] || '').trim() : '';

  return {
    date:        dateKey ? parseDate(row[dateKey]) : null,
    property:    propKey ? normalizeAddress(row[propKey] || '') : '',
    streetLine:  streetKey ? String(row[streetKey] || '').trim() : '',
    city:        cityRaw && stateRaw ? `${toTitleCase(cityRaw)}, ${stateRaw.toUpperCase()}` : toTitleCase(cityRaw),
    description: descKey ? String(row[descKey] || '').trim() : '',
    glAccount:   String(gl || '').trim(),
    accountClass: cls,
    amountIn:    amountIn > 0 ? amountIn : 0,
    amountOut:   amountOut > 0 ? amountOut : 0,
    vendorName:  vendKey ? String(row[vendKey] || '').trim() : '',
    type:        row['Type'] ? String(row['Type']).trim() : '',
    raw: row,
  };
}
