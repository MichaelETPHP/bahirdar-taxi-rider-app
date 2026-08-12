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

export async function logoutRider(accessToken) {
  return post('/auth/logout', undefined, accessToken);
}

export async function refreshTokens(refreshToken) {
  return post('/auth/rider/refresh', { refreshToken });
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
