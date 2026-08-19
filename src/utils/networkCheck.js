// Checks REAL internet connectivity — not the local API server. Uses a
// reliable public DNS endpoint so it works regardless of API server state.
// Used by App.js's continuous offline poll and NoInternetScreen's manual
// retry, so both agree on what "online" means.
const INTERNET_CHECK_URL = 'https://dns.google/resolve?name=example.com&type=A';
const CHECK_TIMEOUT_MS = 4000;

export async function hasRealInternet() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(INTERNET_CHECK_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}
