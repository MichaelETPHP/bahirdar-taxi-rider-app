import { secureStorage } from './secureStorage';

/**
 * One-time migration of sensitive values out of plaintext AsyncStorage
 * into SecureStore (INSA Finding 3 — CWE-312).
 *
 * secureStorage.getItem already migrates lazily on first read; this sweep
 * simply forces that migration for every known sensitive key at startup so
 * no plaintext copy lingers even if a key is never read this session.
 * Idempotent and safe to re-run: once a key has migrated, the AsyncStorage
 * copy is gone and getItem is a plain SecureStore read.
 */

const SENSITIVE_KEYS = [
  'rider_session_data',   // access/refresh JWTs, user profile, session meta
  'rider_phone_number',   // phone number saved for quick login
  'bahirdar_recent_phone', // last phone typed on the login screen
];

export async function migrateSecureStorage() {
  for (const key of SENSITIVE_KEYS) {
    try {
      await secureStorage.getItem(key);
    } catch {
      // Never crash startup over a migration failure.
    }
  }
}
