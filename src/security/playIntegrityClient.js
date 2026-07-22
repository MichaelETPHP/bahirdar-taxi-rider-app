/**
 * Play Integrity client — INSA: root/emulator detection (rider app).
 * Mirrors BahirdarDriver/security/playIntegrityClient.ts.
 *
 * Requests a Google-signed integrity token on device and sends it to the API
 * (POST /security/verify-integrity), which decodes it with Google server-side
 * and stores the verdict for this session. The client never interprets the
 * token itself — only the server's verdict counts.
 *
 * Called after login and before payment actions. Best-effort while the API
 * runs in log-only enforcement mode; once INTEGRITY_ENFORCEMENT=enforce, the
 * server rejects payment mutations for sessions without a fresh passing verdict.
 */
import { Platform } from 'react-native';
import { apiRequest } from '../lib/apiClient';

const PACKAGE_NAME = 'com.bahirdar.rider';
// Re-verify at most every 12h client-side (server freshness window is 24h)
const REVERIFY_INTERVAL_MS = 12 * 60 * 60 * 1000;

let lastVerifiedAt = 0;
let inFlight = null;

function randomNonce() {
  // URL-safe nonce, 24+ chars as Play Integrity requires
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Ensure this session has a fresh server-side integrity verdict.
 * Returns true when the server confirmed device+app integrity, false otherwise
 * (including on iOS, where Play Integrity does not exist).
 */
export async function ensureIntegrityVerdict(force = false) {
  if (Platform.OS !== 'android') return false;
  if (!force && Date.now() - lastVerifiedAt < REVERIFY_INTERVAL_MS) return true;
  if (inFlight) return inFlight;

  inFlight = (async () => {
    try {
      const integrity = await import('react-native-google-play-integrity');
      const available = await integrity.isPlayIntegrityAvailable();
      if (!available) return false;

      const token = await integrity.requestIntegrityToken(randomNonce());
      const data = await apiRequest('POST', '/security/verify-integrity', {
        integrity_token: token,
        package_name: PACKAGE_NAME,
      });
      const verdict = data?.data ?? data;
      const ok = Boolean(verdict?.basic_integrity && verdict?.app_integrity);
      if (ok) lastVerifiedAt = Date.now();
      return ok;
    } catch (e) {
      // Log-only rollout: verification failure is non-fatal client-side
      return false;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
