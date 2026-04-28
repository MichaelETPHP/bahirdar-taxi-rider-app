import { API_BASE_URL } from '../config/api';
import { apiRequest } from '../lib/apiClient';

/**
 * Auth Service — Refactored to use decoupled apiClient.
 */

const get   = (path, token)       => apiRequest('GET',   path, undefined, { customToken: token });
const post  = (path, body, token) => apiRequest('POST',  path, body, { customToken: token });
const patch = (path, body, token) => apiRequest('PATCH', path, body, { customToken: token });

export async function checkPhoneExistence(phone, role = 'rider') {
  return get(`/auth/check-phone?phone=${encodeURIComponent(phone)}&role=${role}`);
}

export async function registerRider(phone) {
  return post('/auth/rider/register', { phone });
}

export async function sendOtp(phone) {
  return post('/auth/rider/otp/send', { phone });
}

export async function verifyOtp(phone, otp) {
  return post('/auth/rider/otp/verify', { phone, otp });
}

export async function fetchVehicleCategories() {
  return get('/vehicle-categories');
}

export async function fetchProfile(accessToken) {
  return get('/users/me', accessToken);
}

export async function updateProfile({ fullName, email, gender, dateOfBirth, preferredLang, avatarUrl }, accessToken) {
  const body = {};
  if (fullName   && fullName.trim())  body.full_name    = fullName.trim();
  if (email      && email.trim())     body.email         = email.trim().toLowerCase();
  if (gender)                         body.gender        = gender;
  if (dateOfBirth)                    body.date_of_birth = dateOfBirth; 
  if (preferredLang)                  body.preferred_lang = preferredLang;
  if (avatarUrl)                      body.avatar_url    = avatarUrl;

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
