import { apiRequest } from '../lib/apiClient';

export async function fetchWalletTransactions(token, { limit = 20, offset = 0 } = {}) {
  return apiRequest('GET', `/payments/wallet/transactions?limit=${limit}&offset=${offset}`, undefined, {
    customToken: token,
  });
}

/**
 * MOCK top-up — credits the wallet instantly server-side, no real charge yet.
 * `amountEtb` must already be converted from whatever currency the picker
 * showed; `method` is 'apple_pay' | 'google_pay' | 'card', recorded for
 * record-keeping even though no real gateway is charged.
 */
export async function topUpWallet(amountEtb, method) {
  return apiRequest('POST', '/payments/wallet/topup', { amount_etb: amountEtb, method });
}
