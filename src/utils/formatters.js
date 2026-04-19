/**
 * Convert local Ethiopian phone (0912345678) to international (+251912345678).
 * Accepts: 0912345678 | 912345678 | +251912345678 | 251912345678
 */
export function toInternationalPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251')) return `+${digits}`;
  if (digits.startsWith('0')) return `+251${digits.slice(1)}`;
  return `+251${digits}`;
}

export function formatPhone(raw) {
  const digits = raw.replace(/\D/g, '');
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10)
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)}`;
}

export function formatPhoneDisplay(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+251 ${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

import { CURRENCY } from '../constants/currency';

export function formatCurrency(amount, currency = CURRENCY) {
  return `${currency} ${amount.toFixed(0)}`;
}

export function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatTime(timeString) {
  const [h, m] = timeString.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export function validateEthiopianPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits.startsWith('09') || digits.startsWith('07');
  }
  // Allow entering without leading 0 (e.g. 9XXXXXXXX or 7XXXXXXXX)
  if (digits.length === 9) {
    return digits.startsWith('9') || digits.startsWith('7');
  }
  return false;
}

/** True when the user has typed an impossible prefix (e.g. 06, 05, 08 — after 0 only 9 or 7 is valid). */
export function hasInvalidEthiopianPhonePrefix(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 0) return false;
  const first = digits[0];
  if (first !== '0' && first !== '9' && first !== '7') return true;
  if (digits.length >= 2 && first === '0') {
    const second = digits[1];
    if (second !== '9' && second !== '7') return true;
  }
  return false;
}

export default {
  formatPhone,
  formatPhoneDisplay,
  formatCurrency,
  formatDate,
  formatTime,
  validateEthiopianPhone,
  hasInvalidEthiopianPhonePrefix,
};
