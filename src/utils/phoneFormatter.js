/**
 * Utility for formatting Ethiopian phone numbers.
 * Formats: 0911223344 -> +251 911 223 344
 * Formats: +251911223344 -> +251 911 223 344
 */
export function formatEthiopianPhone(phone) {
  if (!phone) return '—';
  
  // Remove all non-numeric characters except +
  let cleaned = String(phone).replace(/[^\d+]/g, '');

  // If it starts with 09 or 07, convert to +251
  if (cleaned.startsWith('09') || cleaned.startsWith('07')) {
    cleaned = '+251' + cleaned.substring(1);
  } else if (cleaned.startsWith('9') || cleaned.startsWith('7')) {
    cleaned = '+251' + cleaned;
  }

  // Ensure it starts with +251
  if (!cleaned.startsWith('+251')) {
    // If it's 12 digits starting with 251, add +
    if (cleaned.startsWith('251') && cleaned.length === 12) {
      cleaned = '+' + cleaned;
    } else {
      return phone; // Return as is if we can't recognize it
    }
  }

  // Now format +251XXXXXXXXX as +251 9XX XXX XXX
  // Total length should be 13 (+, 2, 5, 1, and 9 digits)
  if (cleaned.length === 13) {
    const country = cleaned.substring(0, 4); // +251
    const prefix = cleaned.substring(4, 7);  // 9XX
    const mid = cleaned.substring(7, 10);    // XXX
    const end = cleaned.substring(10, 13);   // XXX
    return `${country} ${prefix} ${mid} ${end}`;
  }

  return cleaned;
}
