import { API_BASE_URL } from '../config/api';

import useAuthStore from '../store/authStore';

// Global flag: prevent multiple simultaneous refresh attempts
let _isRefreshing = false;

// Paths that should NEVER trigger a token refresh retry
const NO_RETRY_PATHS = ['/auth/rider/refresh', '/auth/rider/otp/verify', '/auth/logout'];

async function request(method, path, body, accessToken, retryCount = 0) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };

  const activeToken = accessToken || useAuthStore.getState().token;
  if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

  const controller = new AbortController();
  // Increase timeout to 30s for slow registration/SMS provider
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  console.log(`[Auth] ${method} ${url}`, { hasBody: !!body, hasToken: !!activeToken });

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // ── Token Refresh Interceptor ──────────────────────────────────────
    // Only attempt refresh ONCE (retryCount === 0) and only on specific paths.
    // If _isRefreshing, another call already triggered a refresh — skip.
    if (
      res.status === 401 &&
      retryCount === 0 &&
      !_isRefreshing &&
      !NO_RETRY_PATHS.includes(path)
    ) {
      console.warn(`[Auth] 401 at ${path}. Attempting one-time token refresh...`);
      _isRefreshing = true;
      try {
        // Try to get a fresh token via stored refresh token
        const currentRefreshToken = useAuthStore.getState().refreshToken;
        if (!currentRefreshToken) {
          throw new Error('No refresh token available');
        }

        // Call the refresh endpoint directly (not through request() to avoid loops)
        const refreshUrl = `${API_BASE_URL}/auth/rider/refresh`;
        const refreshRes = await fetch(refreshUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: currentRefreshToken }),
        });

        if (!refreshRes.ok) {
          throw new Error(`Refresh failed with status ${refreshRes.status}`);
        }

        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData?.data?.accessToken;
        const newRefreshToken = refreshData?.data?.refreshToken;

        if (!newAccessToken) {
          throw new Error('No access token in refresh response');
        }

        // Save the new tokens
        await useAuthStore.getState().setTokens(newAccessToken, newRefreshToken || currentRefreshToken, 3600);
        console.log(`[Auth] Token refreshed. Retrying ${path}...`);

        // Retry the original request exactly ONCE with the new token
        return request(method, path, body, newAccessToken, 1);

      } catch (refreshErr) {
        // Refresh itself failed — the session is truly expired or invalid
        console.error(`[Auth] Token refresh failed at ${path}:`, refreshErr.message, '→ Logging out.');
        useAuthStore.getState().logout();
        throw { status: 401, message: 'Session expired. Please log in again.' };
      } finally {
        _isRefreshing = false;
      }
    }
    // ──────────────────────────────────────────────────────────────────

    const data = await res.json();
    if (!res.ok) throw { status: res.status, message: data?.error?.message || data?.message || 'Request failed', code: data?.error?.code };
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}


const get   = (path, token)       => request('GET',   path, undefined, token);
const post  = (path, body, token) => request('POST',  path, body, token);
const patch = (path, body, token) => request('PATCH', path, body, token);

/**
 * Check if a phone number exists in the system.
 * GET /auth/check-phone?phone=...&role=rider
 * Returns: { success, data: { exists, role, status, can_login } }
 */
export async function checkPhoneExistence(phone, role = 'rider') {
  return get(`/auth/check-phone?phone=${encodeURIComponent(phone)}&role=${role}`);
}

/**
 * Register a new rider.
 * POST /auth/rider/register  { phone }
 * 201 → new user, OTP auto-sent  |  409 → existing user
 * Returns: { success, data: { userId, message } }
 */
export async function registerRider(phone) {
  return post('/auth/rider/register', { phone });
}

/**
 * Send / resend OTP to an existing rider.
 * POST /auth/rider/otp/send
 * Body: { phone }
 * Returns: { success, data: { expiresIn: 600 } }
 */
export async function sendOtp(phone) {
  return post('/auth/rider/otp/send', { phone });
}

/**
 * Verify OTP.
 * POST /auth/rider/otp/verify
 * Body: { phone, otp }
 * Returns: { success, data: { accessToken, refreshToken, user } }
 */
export async function verifyOtp(phone, otp) {
  return post('/auth/rider/otp/verify', { phone, otp });
}

/**
 * Fetch vehicle categories (no auth required).
 * GET /vehicle-categories
 * Returns: { success, data: { categories: [...], total } }
 */
export async function fetchVehicleCategories() {
  return get('/vehicle-categories');
}

/**
 * Fetch the current user's full profile.
 * GET /users/me
 * Requires: Authorization: Bearer <accessToken>
 * Returns: { success, data: { id, full_name, email, gender, date_of_birth, avatar_url, ... } }
 */
export async function fetchProfile(accessToken) {
  return get('/users/me', accessToken);
}

/**
 * Update the current user's profile.
 * PATCH /users/me  { full_name, email, gender, date_of_birth }
 * Requires: Authorization: Bearer <accessToken>
 * Returns: { success, data: { user } }
 */
export async function updateProfile({ fullName, email, gender, dateOfBirth, preferredLang, avatarUrl }, accessToken) {
  const body = {};
  // Only include fields with real values — Zod rejects empty strings even for optional fields
  if (fullName   && fullName.trim())  body.full_name    = fullName.trim();
  if (email      && email.trim())     body.email         = email.trim().toLowerCase();
  if (gender)                         body.gender        = gender;
  if (dateOfBirth)                    body.date_of_birth = dateOfBirth; // 'YYYY-MM-DD'
  if (preferredLang)                  body.preferred_lang = preferredLang;
  if (avatarUrl)                      body.avatar_url    = avatarUrl;

  return patch('/users/me', body, accessToken);
}

/**
 * Upload profile avatar image.
 * POST /users/me/avatar
 * Requires: FormData with 'avatar' field
 * Returns: { success, data: { avatar_url } }
 */
export async function uploadAvatar(formData, accessToken) {
  const url = `${API_BASE_URL}/users/me/avatar`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok) throw { status: res.status, message: data?.error?.message || data?.message || 'Upload failed' };
  return data;
}

/**
 * Logout — revokes current session.
 * POST /auth/logout
 * Requires: Authorization: Bearer <accessToken>
 */
export async function logoutRider(accessToken) {
  return post('/auth/logout', undefined, accessToken);
}

/**
 * Refresh expired access token.
 * POST /auth/refresh
 * Body: { refreshToken }
 * Returns: { success, data: { accessToken, refreshToken } }
 */
export async function refreshTokens(refreshToken) {
  return post('/auth/rider/refresh', { refreshToken });
}
