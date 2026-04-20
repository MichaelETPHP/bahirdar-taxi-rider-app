import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Session Manager - Handles 30-day persistent login
 *
 * Stores:
 * - Tokens (access + refresh)
 * - Login timestamp (when user first authenticated)
 * - Last activity (when app was last used)
 * - Session expiration (30 days from login)
 */

const SESSION_KEY = 'rider_session_data';
const SESSION_TIMEOUT = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
const TOKEN_REFRESH_BUFFER = 5 * 60 * 1000; // Refresh 5 min before expiry

export async function saveSession(accessToken, refreshToken, expiresIn = 3600) {
  try {
    const now = Date.now();
    const sessionData = {
      accessToken,
      refreshToken,
      loginTime: now,
      lastActivity: now,
      expiresAt: now + SESSION_TIMEOUT,
      tokenExpiresAt: now + (expiresIn * 1000),
    };

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
    return sessionData;
  } catch (error) {
    console.error('Failed to save session:', error);
    throw error;
  }
}

export async function getSession() {
  try {
    const sessionJson = await AsyncStorage.getItem(SESSION_KEY);
    if (!sessionJson) return null;

    const session = JSON.parse(sessionJson);

    // Check if session has expired (30 days)
    if (Date.now() > session.expiresAt) {
      await clearSession();
      return null;
    }

    return session;
  } catch (error) {
    console.error('Failed to get session:', error);
    return null;
  }
}

export async function updateLastActivity() {
  try {
    const session = await getSession();
    if (!session) return;

    session.lastActivity = Date.now();
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to update activity:', error);
  }
}

export async function updateTokens(accessToken, refreshToken, expiresIn = 3600) {
  try {
    const session = await getSession();
    if (!session) return;

    session.accessToken = accessToken;
    session.refreshToken = refreshToken;
    session.tokenExpiresAt = Date.now() + (expiresIn * 1000);
    session.lastActivity = Date.now();

    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  } catch (error) {
    console.error('Failed to update tokens:', error);
    throw error;
  }
}

export async function clearSession() {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error('Failed to clear session:', error);
  }
}

export async function getSessionStatus() {
  try {
    const session = await getSession();
    if (!session) {
      return { status: 'no_session', reason: 'No active session' };
    }

    const now = Date.now();
    const daysRemaining = Math.floor((session.expiresAt - now) / (24 * 60 * 60 * 1000));
    const hoursRemaining = Math.floor(((session.expiresAt - now) % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));

    // Check if token needs refresh
    const needsRefresh = now > (session.tokenExpiresAt - TOKEN_REFRESH_BUFFER);

    return {
      status: 'active',
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      loginTime: new Date(session.loginTime),
      expiresAt: new Date(session.expiresAt),
      daysRemaining,
      hoursRemaining,
      needsRefresh,
      lastActivity: new Date(session.lastActivity),
    };
  } catch (error) {
    console.error('Failed to get session status:', error);
    return { status: 'error', reason: error.message };
  }
}

export function getSessionTimeRemaining() {
  return SESSION_TIMEOUT;
}
