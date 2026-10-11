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
import { createPinningInitializer } from './pinningInitialization';

const PINNED_DOMAIN = 'bahirantransport.tech';
// Verified against the new VPS's live chain: Let's Encrypt YR2 -> ISRG Root
// YR -> ISRG Root X1. The intermediate-specific hash below (labeled YR1) no
// longer matches directly, but "ISRG Root YR" does — kept as-is since
// pinning passes on ANY matching key in the chain, and the two root-level
// hashes (shared across all Let's Encrypt chains) are unaffected by which
// short-lived intermediate actually signed this particular cert.

const PUBLIC_KEY_HASHES = [
  'LoMHBotttiDko50Gi13uXW71eIy7LAttI+rYT8wXF4w=', // Let's Encrypt YR1 (intermediate)
  'fk6IOKit1ild5647BH06ujSIq5XbCgqlbYl6ANhhi88=', // ISRG Root YR (served root)
  'C5+lpZ7tcVwmwQIMcRtPbsQtWLABXhQzejna0wHFr8M=', // ISRG Root X1 (backup)
];

export const initSslPinning = createPinningInitializer(async () => {
  if (!isSslPinningAvailable()) {
    if (__DEV__) { console.warn('[sslPinning] Development build has no pinning module'); return; }
    const error = new Error('Secure connection unavailable. Install the latest app build.');
    error.code = 'NATIVE_BUILD_REQUIRED';
    throw error;
  }
  await initializeSslPinning({
    [PINNED_DOMAIN]: {
      includeSubdomains: false,
      publicKeyHashes: PUBLIC_KEY_HASHES,
    },
  });
});
