import { API_BASE_URL } from '../config/api';

// ── Dev logging helpers ────────────────────────────────────────────────────
const _QUIET = ['/riders/me/location', '/drivers/location/'];
const _isQuiet = (path) => _QUIET.some((p) => path.includes(p));

const _LABELS = [
  [/trips\/[^/]+\/fare-estimate/, 'fare-estimate   '],
  [/trips\/[^/]+\/complete/,      'trip-complete   '],
  [/trips\/[^/]+\/cancel/,        'trip-cancel     '],
  [/trips\/[^/]+\/rate/,          'trip-rate       '],
  [/trips\/[a-f0-9-]{36}/,        'trip-status     '],
  [/\/trips$/,                    'request-trip    '],
  [/riders\/me\/location/,        'location-sync   '],
  [/riders\/me/,                  'rider-profile   '],
  [/auth\/rider\/otp/,            'otp             '],
  [/auth\/rider\/refresh/,        'token-refresh   '],
  [/drivers\/[^/]+\/location/,    'driver-location '],
  [/drivers\/[^/]+/,              'driver-detail   '],
];

const _labelFor = (path) => {
  for (const [re, label] of _LABELS) {
    if (re.test(path)) return label;
  }
  const parts = path.replace(/\?.*/, '').split('/').filter(Boolean);
  return parts.slice(-2).join('/').padEnd(16);
};

const _summarise = (path, data) => {
  try {
    if (!data || typeof data !== 'object') return '';
    const inner = data.data ?? data;
    if (/trips\/[a-f0-9-]{36}/.test(path) && !/fare|complete|cancel|rate/.test(path)) {
      const t = inner.trip ?? inner;
      return `status=${t.status ?? '?'}${t.driver?.full_name ? '  driver=' + t.driver.full_name : ''}`;
    }
    if (/fare-estimate/.test(path)) return `ETB ${inner.total_fare_etb ?? '?'}  dist=${inner.distance_km ?? '?'}km`;
    if (/\/trips$/.test(path)) { const t = inner.trip ?? inner; return `id=${String(t.id ?? '').slice(0, 8)}  status=${t.status ?? '?'}`; }
  } catch (_) {}
  return '';
};
// ──────────────────────────────────────────────────────────────────────────

let _tokenGetter = () => null;
let _refreshTokenGetter = () => null;
let _onTokenRefreshed = async (newAccessToken, newRefreshToken) => {};
let _onSessionExpired = async () => {};
let _onMaintenance = async (data) => {};

// ── Shared-refresh + proactive-refresh guard ────────────────────────────────
// Refresh tokens rotate (single-use) — the OLD interceptor let every 401 in a
// burst of parallel requests (e.g. several screens re-fetching right as the
// app resumes from background) race its OWN independent refresh call. The
// first to land succeeded and rotated the token; every other concurrent
// refresh then got rejected by the server as already-consumed, and each one
// individually called _onSessionExpired() — logging out a session that had
// JUST been validly refreshed a moment earlier, and firing the "session
// expired" banner once per failed request instead of once. This is what
// "logged out randomly" / "banner shows again and again" actually was.
let _refreshPromise = null;
let _sessionExpiredNotifying = false;

function decodeJwtExpiryMs(token) {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('utf8');
    const { exp } = JSON.parse(json);
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch (_) {
    return null;
  }
}

async function performRefresh(refreshToken) {
  try {
    const refreshRes = await fetch(`${API_BASE_URL}/auth/rider/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!refreshRes.ok) return null;
    const refreshData = await refreshRes.json();
    const newToken = refreshData?.data?.accessToken;
    const newRefresh = refreshData?.data?.refreshToken;
    if (!newToken) return null;
    await _onTokenRefreshed(newToken, newRefresh || refreshToken);
    return newToken;
  } catch (err) {
    console.error('[API] Refresh error:', err);
    return null;
  }
}

/** Every concurrent caller shares this ONE in-flight refresh instead of each racing their own. */
function getSharedRefresh() {
  if (!_refreshPromise) {
    const refreshToken = _refreshTokenGetter();
    if (!refreshToken) return Promise.resolve(null);
    _refreshPromise = performRefresh(refreshToken).finally(() => {
      _refreshPromise = null;
    });
  }
  return _refreshPromise;
}

/** Fires _onSessionExpired() at most once per real failure, not once per concurrent request that hit it. */
async function notifySessionExpiredOnce() {
  if (_sessionExpiredNotifying) return;
  _sessionExpiredNotifying = true;
  try {
    await _onSessionExpired();
  } finally {
    setTimeout(() => { _sessionExpiredNotifying = false; }, 3000);
  }
}

/**
 * Initialize the API client with store callbacks.
 * Call this in your App entry point or store initialization.
 */
export const initApiClient = ({ getToken, getRefreshToken, onRefreshed, onExpired, onMaintenance }) => {
  if (getToken) _tokenGetter = getToken;
  if (getRefreshToken) _refreshTokenGetter = getRefreshToken;
  if (onRefreshed) _onTokenRefreshed = onRefreshed;
  if (onExpired) _onSessionExpired = onExpired;
  if (onMaintenance) _onMaintenance = onMaintenance;
};

export async function apiRequest(method, path, body, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  const { retryCount = 0, timeout = 10000, customToken = null } = options;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers
  };

  let activeToken = customToken || _tokenGetter();

  // Proactive refresh — if the token is about to expire (<60s left), refresh
  // BEFORE sending rather than waiting to be told via a 401. Cuts down how
  // often the reactive path below even gets exercised at all, since a token
  // that's already about to expire is exactly the situation where a burst
  // of parallel requests (app resume, screen mount) used to race each other.
  if (!customToken && activeToken?.startsWith('eyJ') && !options._skipProactiveRefresh) {
    const expMs = decodeJwtExpiryMs(activeToken);
    if (expMs && expMs - Date.now() < 60_000 && _refreshTokenGetter()) {
      const refreshed = await getSharedRefresh();
      if (refreshed) activeToken = refreshed;
    }
  }

  if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

  const _quiet = _isQuiet(path);
  const _label = _labelFor(path);
  const _t0    = __DEV__ ? Date.now() : 0;

  if (__DEV__ && !_quiet) {
    const bodyPreview = body ? JSON.stringify(body).slice(0, 80) : '';
    console.log(`[API] →  ${_label}  (${method})${bodyPreview ? '  ' + bodyPreview : ''}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // ── Token Refresh Interceptor ──────────────────────────────────────
    // Don't attempt refresh if there's no refresh token, or the token that
    // just got rejected wasn't even a real JWT (a local placeholder token).
    if (res.status === 401 && retryCount === 0 && activeToken?.startsWith('eyJ') && _refreshTokenGetter()) {
      const newToken = await getSharedRefresh();
      if (newToken) {
        return apiRequest(method, path, body, { ...options, retryCount: 1, customToken: newToken });
      }
      // Refresh genuinely failed — every concurrent request that hit this
      // same failure shares the one notification instead of each firing it.
      await notifySessionExpiredOnce();
      throw { status: 401, message: 'Session expired', code: 'UNAUTHORIZED', response: { status: 401, data: null } };
    }
    if (res.status === 401 && retryCount === 0) {
      // No refresh token / not a real JWT to begin with — genuinely nothing to recover.
      await notifySessionExpiredOnce();
      throw { status: 401, message: 'Session expired', code: 'UNAUTHORIZED', response: { status: 401, data: null } };
    }
    // ──────────────────────────────────────────────────────────────────

    // 204/205 No Content — no body to parse
    if (res.status === 204 || res.status === 205) {
      if (__DEV__ && !_quiet) {
        const dur = `${Date.now() - _t0}ms`.padEnd(6);
        console.log(`[API] ←  ${_label}  ${res.status}  ${dur}`);
      }
      return null;
    }

    const data = await res.json();

    if (res.status === 503 && data.code === 'MAINTENANCE_MODE') {
      await _onMaintenance(data);
      throw { status: 503, message: 'Maintenance mode', code: 'MAINTENANCE_MODE', data };
    }

    if (!res.ok) {
      if (__DEV__ && !_quiet) {
        const dur = `${Date.now() - _t0}ms`.padEnd(6);
        console.warn(`[API] ✗  ${_label}  ${res.status}  ${dur}  ${data?.error?.code ?? data?.message ?? ''}`);
      }
      throw {
        status: res.status,
        message: data?.error?.message || data?.message || 'Request failed',
        code: data?.error?.code,
        response: { status: res.status, data },
        data,
      };
    }

    if (__DEV__ && !_quiet) {
      const dur     = `${Date.now() - _t0}ms`.padEnd(6);
      const summary = _summarise(path, data);
      console.log(`[API] ←  ${_label}  ${res.status}  ${dur}${summary ? '   ' + summary : ''}`);
    }
    return data;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      if (__DEV__ && !_quiet) {
        console.warn(`[API] ✗  ${_label}  408  TIMEOUT`);
      }
      throw { status: 408, message: 'Request timeout', code: 'TIMEOUT' };
    }
    throw err;
  }
}
