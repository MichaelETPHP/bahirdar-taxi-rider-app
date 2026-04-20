import { saveSession, getSession, clearSession, updateTokens, getSavedPhone } from './sessionManager';

/**
 * Token Storage - Wrapper for persistent 30-day session
 * Uses sessionManager under the hood for proper expiration handling
 */

export async function saveTokens(accessToken, refreshToken, expiresIn = 3600, phone = null) {
  return await saveSession(accessToken, refreshToken, expiresIn, phone);
}

export async function getStoredPhone() {
  return await getSavedPhone();
}

export async function getTokens() {
  const session = await getSession();
  if (!session) {
    return { accessToken: null, refreshToken: null };
  }
  return {
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  };
}

export async function updateTokensOnly(accessToken, refreshToken, expiresIn = 3600) {
  return await updateTokens(accessToken, refreshToken, expiresIn);
}

export async function clearTokens() {
  return await clearSession();
}
