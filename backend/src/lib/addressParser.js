// Splits a full address string into house number, street, and city for display + concealment.
export function parseAddress(fullAddress) {
  let trimmed = String(fullAddress || '').trim();

  // AppFolio often exports "<unit label> - <street address>"; keep the street half.
  const dash = trimmed.split(/\s+-\s+/);
  if (dash.length === 2) trimmed = dash[1].trim();

  // Trailing "City, ST 12345"
  let street = trimmed;
  let city = '';
  const tail = trimmed.match(/^(.*?),?\s+([A-Za-z][A-Za-z .'-]*?),\s*([A-Za-z]{2})\.?\s*(\d{5}(?:-\d{4})?)?$/);
  if (tail) {
    street = tail[1].trim();
    city = `${tail[2].trim()}, ${tail[3].toUpperCase()}`;
  }

  const num = street.match(/^(\d+[A-Za-z-]*)\s+(.+)$/);
  if (num) {
    return { houseNumber: num[1], num: num[1], street: num[2], city };
  }
  return { houseNumber: null, num: '', street, city };
}
