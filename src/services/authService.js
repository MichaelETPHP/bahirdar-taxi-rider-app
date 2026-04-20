import { API_BASE_URL } from '../config/api';

import useAuthStore from '../store/authStore';

async function request(method, path, body, accessToken, retryCount = 0) {
  const url = `${API_BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json' };
  
  const activeToken = accessToken || useAuthStore.getState().token;
  if (activeToken) headers['Authorization'] = `Bearer ${activeToken}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // ── Token Refresh Interceptor (PRO Handle 401) ──
    if (res.status === 401 && retryCount === 0 && path !== '/auth/refresh' && path !== '/auth/rider/otp/verify') {
      console.warn(`[Auth] 401 Detected at ${path}. Attempting token refresh...`);
      const refreshed = await useAuthStore.getState().loadTokens();
      if (refreshed) {
        const newToken = useAuthStore.getState().token;
        console.log(`[Auth] Refresh successful. Retrying ${path}...`);
        return request(method, path, body, newToken, retryCount + 1);
      } else {
        // Refresh failed (refresh token expired) - force logout
        console.error(`[Auth] Critical Auth Error at ${path}. Logging out...`);
        useAuthStore.getState().logout();
      }
    }

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
export async function updateProfile({ fullName, email, gender, dateOfBirth }, accessToken) {
  const body = {};
  if (fullName !== undefined) body.full_name = fullName;
  if (email !== undefined) body.email = email;
  if (gender !== undefined) body.gender = gender;
  if (dateOfBirth !== undefined) body.date_of_birth = dateOfBirth; // 'YYYY-MM-DD'
  return patch('/users/me', body, accessToken);
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
  return post('/auth/refresh', { refreshToken });
}
