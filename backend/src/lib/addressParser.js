// Splits a full address string into house number and street for concealment.
export function parseAddress(fullAddress) {
  const trimmed = fullAddress.trim();
  // Handles: "1847 Maple Ridge Drive", "1847A Elm St", "1847-B Oak Ave"
  const match = trimmed.match(/^(\d+[A-Za-z-]*)\s+(.+)$/);
  if (match) {
    return { houseNumber: match[1], street: match[2] };
  }
  return { houseNumber: null, street: trimmed };
}
