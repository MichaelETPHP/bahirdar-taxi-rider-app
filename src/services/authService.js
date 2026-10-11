import { API_BASE_URL } from '../config/api';
import { apiRequest } from '../lib/apiClient';

/**
 * Auth Service — Refactored to use decoupled apiClient.
 */

const get    = (path, token)       => apiRequest('GET',    path, undefined, { customToken: token });
const post   = (path, body, token) => apiRequest('POST',   path, body,      { customToken: token });
const patch  = (path, body, token) => apiRequest('PATCH',  path, body,      { customToken: token });
const del    = (path, body, token) => apiRequest('DELETE', path, body,      { customToken: token });

export async function checkPhoneExistence(phone, role = 'rider') {
  return get(`/auth/check-phone?phone=${encodeURIComponent(phone)}&role=${role}`);
}

export async function registerRider(phone) {
  return post('/auth/rider/register', { phone });
}

export async function sendOtp(phone) {
  return post('/auth/rider/otp/send', { phone });
}

export async function verifyOtp(phone, otp, deviceInfo = {}) {
  return post('/auth/rider/otp/verify', {
    phone,
    otp,
    device_id: deviceInfo.device_id,
    platform: deviceInfo.platform,
  });
}

export async function googleLogin(idToken, deviceInfo = {}) {
  return post('/auth/rider/google', {
    id_token: idToken,
    device_id: deviceInfo.device_id,
    platform: deviceInfo.platform,
  });
}

export async function appleLogin(idToken, fullName, deviceInfo = {}) {
  return post('/auth/rider/apple', {
    id_token: idToken,
    // Only ever set on this Apple ID's first-ever authorization — omitted
    // (undefined) on every later login, same as the backend expects.
    full_name: fullName || undefined,
    device_id: deviceInfo.device_id,
    platform: deviceInfo.platform,
  });
}

export async function fetchVehicleCategories() {
  return get('/vehicle-categories');
}

export async function fetchProfile(accessToken) {
  return get('/users/me', accessToken);
}

export async function updateProfile({ fullName, email, gender, dateOfBirth, preferredLang, avatarUrl, googleIdToken }, accessToken) {
  const body = {};
  if (fullName   && fullName.trim())  body.full_name    = fullName.trim();
  if (email      && email.trim())     body.email         = email.trim().toLowerCase();
  if (gender)                         body.gender        = gender;
  if (dateOfBirth)                    body.date_of_birth = dateOfBirth;
  if (preferredLang)                  body.preferred_lang = preferredLang;
  if (avatarUrl)                      body.avatar_url    = avatarUrl;
  // Backend verifies this and uses its own email/name, ignoring the plain
  // `email` above when both are present — see users.controller.updateMe.
  if (googleIdToken)                  body.google_id_token = googleIdToken;

  return patch('/users/me', body, accessToken);
}

export async function uploadAvatar(formData, accessToken) {
  await (await import('../security/sslPinning')).initSslPinning();
  // Manual fetch for multipart/form-data
  const res = await fetch(`${API_BASE_URL}/users/me/avatar`, {
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

export async function logoutRider(accessToken, refreshToken) {
  await (await import('../security/sslPinning')).initSslPinning();
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${API_BASE_URL}/auth/${refreshToken ? 'logout/refresh' : 'logout'}`, {
      method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: refreshToken ? JSON.stringify({ refreshToken }) : undefined,
    });
    if (!res.ok && res.status !== 401) {
      const payload = await res.json().catch(() => null);
      const error = new Error(payload?.error?.message || `Session revocation failed (HTTP ${res.status}). Please retry.`);
      error.status = res.status;
      error.code = payload?.error?.code || 'LOGOUT_FAILED';
      throw error;
    }
  } finally { clearTimeout(deadline); }
}

export async function refreshTokens(refreshToken) {
  const { getSharedRefresh } = await import('../lib/apiClient');
  const accessToken = await getSharedRefresh();
  if (!accessToken) {
    const error = new Error('Session expired');
    error.status = 401;
    throw error;
  }
  const { default: authStore } = await import('../store/authStore');
  return { data: { accessToken, refreshToken: authStore.getState().refreshToken } };
}

export async function deleteAccount(reason, accessToken) {
  return del('/users/me', reason ? { reason } : undefined, accessToken);
}

/** Saves an Expo push token so the backend can reach this device (trip
 * updates, and now incoming in-app calls) when the socket isn't connected —
 * e.g. app backgrounded or closed. Role-agnostic endpoint (same one drivers
 * use under the hood), so no rider-specific backend work was needed. */
export async function registerDevice(expoPushToken, deviceId, platform, accessToken) {
  return post('/users/me/device', { fcm_token: expoPushToken, device_id: deviceId, platform }, accessToken);
}
