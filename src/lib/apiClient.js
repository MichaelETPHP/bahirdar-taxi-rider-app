import { API_BASE_URL } from '../config/api';

/**
 * Decoupled API Client to prevent Require Cycles.
 * Does NOT import any stores.
 */

let _tokenGetter = () => null;
let _refreshTokenGetter = () => null;
let _onTokenRefreshed = async (newAccessToken, newRefreshToken) => {};
let _onSessionExpired = async () => {};

let _isRefreshing = false;

/**
 * Initialize the API client with store callbacks.
 * Call this in your App entry point or store initialization.
 */
export const initApiClient = ({ getToken, getRefreshToken, onRefreshed, onExpired }) => {
  if (getToken) _tokenGetter = getToken;
  if (getRefreshToken) _refreshTokenGetter = getRefreshToken;
  if (onRefreshed) _onTokenRefreshed = onRefreshed;
  if (onExpired) _onSessionExpired = onExpired;
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
    if (!res.ok) {
      throw { 
        status: res.status, 
        message: data?.error?.message || data?.message || 'Request failed',
        code: data?.error?.code 
      };
    }
    return data;

  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw { status: 408, message: 'Request timeout', code: 'TIMEOUT' };
    }
    throw err;
  }
}
