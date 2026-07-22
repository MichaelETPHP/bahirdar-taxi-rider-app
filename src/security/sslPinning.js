/**
 * SSL public-key pinning — INSA: secure app↔backend communication (rider).
 * Mirrors BahirdarDriver/security/sslPinning.ts — see that file for the full
 * rationale. Pins CA keys (not the leaf) so Let's Encrypt renewals never
 * brick the app, while MITM proxies can never impersonate the backend.
 */
import {
  initializeSslPinning,
  isSslPinningAvailable,
} from 'react-native-ssl-public-key-pinning';

const PINNED_DOMAIN = 'taxiapi.zmichael.click';

const PUBLIC_KEY_HASHES = [
  'LoMHBotttiDko50Gi13uXW71eIy7LAttI+rYT8wXF4w=', // Let's Encrypt YR1 (intermediate)
  'fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=', // ISRG Root YR (served root)
  'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=', // ISRG Root X1 (backup)
];

export async function initSslPinning() {
  try {
    if (!isSslPinningAvailable()) return; // Expo Go / unsupported platform
    await initializeSslPinning({
      [PINNED_DOMAIN]: {
        includeSubdomains: false,
        publicKeyHashes: PUBLIC_KEY_HASHES,
      },
    });
  } catch (e) {
    // Pinning must never crash startup; without init the app simply falls
    // back to standard TLS validation.
    if (__DEV__) console.warn('[sslPinning] init failed', e);
  }
}
