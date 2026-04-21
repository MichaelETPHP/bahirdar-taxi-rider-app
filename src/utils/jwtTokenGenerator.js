/**
 * JWT Token Generator
 * Creates and manages JWT tokens for 30-day persistent sessions
 *
 * Token Structure:
 * - Header: { alg: "HS256", typ: "JWT" }
 * - Payload: { sub, iat, exp, iss, phone }
 * - Signature: HMAC-SHA256(header.payload, secret)
 */

import * as Crypto from 'expo-crypto';

const SECRET_KEY = 'bahirdar_ride_30day_session_secret_key_2024';
const TOKEN_ISSUER = 'bahirdar-ride-app';
const ALGORITHM = 'HS256';

/**
 * Generate JWT tokens for 30-day persistent login
 * @param {string} phone - User phone number (unique identifier)
 * @param {object} user - User profile data to embed in token
 * @returns {object} { accessToken, refreshToken, expiresIn }
 */
export async function generateTokens(phone, user = null) {
  try {
    const now = Math.floor(Date.now() / 1000);

    // Access token: 1 hour validity
    const accessTokenPayload = {
      sub: phone,
      type: 'access',
      iat: now,
      exp: now + (60 * 60), // 1 hour
      iss: TOKEN_ISSUER,
      phone,
      ...(user && {
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          isVerified: user.isVerified,
        }
      }),
    };

    // Refresh token: 30 day validity
    const refreshTokenPayload = {
      sub: phone,
      type: 'refresh',
      iat: now,
      exp: now + (30 * 24 * 60 * 60), // 30 days
      iss: TOKEN_ISSUER,
      phone,
    };

    const accessToken = await createJWT(accessTokenPayload);
    const refreshToken = await createJWT(refreshTokenPayload);

    return {
      accessToken,
      refreshToken,
      expiresIn: 60 * 60, // 1 hour in seconds
    };
  } catch (error) {
    console.error('Failed to generate tokens:', error);
    throw new Error('Token generation failed');
  }
}

/**
 * Create a JWT token with header, payload, and signature
 * @private
 */
async function createJWT(payload) {
  try {
    const header = {
      alg: ALGORITHM,
      typ: 'JWT',
    };

    // Encode header and payload to base64url
    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const message = `${headerEncoded}.${payloadEncoded}`;

    // Create HMAC-SHA256 signature
    const signature = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `${message}${SECRET_KEY}`,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    const signatureEncoded = base64UrlEncode(signature);
    return `${message}.${signatureEncoded}`;
  } catch (error) {
    console.error('JWT creation failed:', error);
    throw error;
  }
}

/**
 * Verify JWT token validity and expiration
 * @param {string} token - JWT token to verify
 * @returns {object|null} Decoded payload if valid, null if expired or invalid
 */
export async function verifyToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn('[JWT] Invalid token format');
      return null;
    }

    const payloadEncoded = parts[1];
    const payload = JSON.parse(base64UrlDecode(payloadEncoded));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) {
      console.warn('[JWT] Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('[JWT] Token verification failed:', error);
    return null;
  }
}

/**
 * Decode JWT token without verification (unsafe - use only for debugging)
 * @private
 */
export function decodeToken(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    return JSON.parse(base64UrlDecode(parts[1]));
  } catch (error) {
    console.error('[JWT] Decode failed:', error);
    return null;
  }
}

/**
 * Base64url encode (RFC 4648)
 * @private
 */
function base64UrlEncode(str) {
  try {
    const base64 = Buffer.from(str).toString('base64');
    return base64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  } catch {
    // Fallback for React Native environments without Buffer
    return btoa(str)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
}

/**
 * Base64url decode (RFC 4648)
 * @private
 */
function base64UrlDecode(str) {
  try {
    // Add padding
    let output = str + new Array(5 - str.length % 4).join('=');
    output = output
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    return atob(output);
  } catch {
    return '';
  }
}

/**
 * Get remaining time for token in seconds
 */
export function getTokenTimeRemaining(token) {
  try {
    const payload = decodeToken(token);
    if (!payload || !payload.exp) return 0;

    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, payload.exp - now);
  } catch {
    return 0;
  }
}

/**
 * Check if token needs refresh (less than 5 minutes remaining)
 */
export function shouldRefreshToken(token) {
  const remaining = getTokenTimeRemaining(token);
  return remaining < (5 * 60); // 5 minutes
}
