import { apiRequest } from '../lib/apiClient';

export async function fetchWalletTransactions(token, { limit = 20, offset = 0 } = {}) {
  return apiRequest('GET', `/payments/wallet/transactions?limit=${limit}&offset=${offset}`, undefined, {
    customToken: token,
  });
}

/** Admin-configured USD → ETB rate used to price the top-up before charging. */
export async function fetchTopupRate() {
  return apiRequest('GET', '/payments/wallet/topup/rate');
}

/**
 * Creates a Stripe PaymentIntent for a wallet top-up. Returns the
 * client_secret the PaymentSheet/Apple Pay/Google Pay confirmation needs —
 * the wallet is NOT credited yet at this point, only once the backend's
 * Stripe webhook sees the charge actually succeed.
 */
export async function createTopupIntent(amountUsd, method) {
  return apiRequest('POST', '/payments/wallet/topup/intent', { amount_usd: amountUsd, method });
}

/** How much of the current balance can actually be withdrawn right now
 * (top-ups older than ~6 months age out of Stripe's refund window). */
export async function fetchWithdrawEligibleAmount() {
  return apiRequest('GET', '/payments/wallet/withdraw/eligible-amount');
}

/**
 * Withdraws any amount up to the wallet balance, refunded to the original
 * card(s) it was topped up with — may draw from more than one past top-up.
 * The balance updates immediately in the response; the actual card refund
 * settles over the following days on the rider's statement.
 *
 * `idempotencyKey` must stay the SAME across retries of the same logical
 * attempt (e.g. a client-side timeout followed by the rider tapping again)
 * — the backend uses it to recognize a retry and return the original
 * result instead of processing a second, independent withdrawal. A longer
 * timeout than the default: a withdrawal spanning several past top-ups
 * makes that many sequential Stripe calls, which can genuinely take a while.
 */
export async function requestWithdrawal(amountEtb, idempotencyKey) {
  return apiRequest(
    'POST',
    '/payments/wallet/withdraw',
    { amount_etb: amountEtb, idempotency_key: idempotencyKey },
    { timeout: 30000 }
  );
}
