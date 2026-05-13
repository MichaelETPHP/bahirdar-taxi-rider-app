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

let _isRefreshing = false;

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
  const { retryCount = 0, timeout = 30000, customToken = null } = options;

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...options.headers
  };

  const activeToken = customToken || _tokenGetter();
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
    if (res.status === 401 && retryCount === 0 && !_isRefreshing) {
      const refreshToken = _refreshTokenGetter();
      
      // Don't attempt refresh if no refresh token or if it's a mock token (doesn't start with eyJ)
      if (refreshToken && activeToken?.startsWith('eyJ')) {
        _isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/rider/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData?.data?.accessToken;
            const newRefresh = refreshData?.data?.refreshToken;

            if (newToken) {
              await _onTokenRefreshed(newToken, newRefresh || refreshToken);
              _isRefreshing = false;
              // Retry original request
              return apiRequest(method, path, body, { ...options, retryCount: 1, customToken: newToken });
            }
          }
        } catch (err) {
          console.error('[API] Refresh error:', err);
        } finally {
          _isRefreshing = false;
        }
      }
      // If we reach here, refresh failed or was skipped
      await _onSessionExpired();
      throw { status: 401, message: 'Session expired' };
    }
    // ──────────────────────────────────────────────────────────────────

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
        code: data?.error?.code
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
