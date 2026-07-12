import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Secure Storage — hardware-encrypted storage for sensitive values
 * (Android Keystore / iOS Keychain via expo-secure-store).
 *
 * Mirrors the AsyncStorage interface so callers don't change.
 *
 * getItem transparently migrates a value that still lives in plaintext
 * AsyncStorage (pre-remediation installs): on a SecureStore miss it reads
 * the legacy AsyncStorage copy, writes it to SecureStore, deletes the
 * plaintext copy, and returns the value — so existing sessions survive
 * the upgrade without a re-login, regardless of call order at startup.
 *
 * SecureStore keys must match [A-Za-z0-9._-]; all keys stored here already do.
 */

const opts = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// expo-secure-store recommends values stay under 2048 bytes. Larger values
// currently still store, but must never fail silently (INSA Finding 3 fix).
const SIZE_WARN_BYTES = 2048;

export const secureStorage = {
  getItem: async (key) => {
    let value = await SecureStore.getItemAsync(key, opts);
    if (value == null) {
      try {
        const legacy = await AsyncStorage.getItem(key);
        if (legacy != null) {
          await SecureStore.setItemAsync(key, legacy, opts);
          await AsyncStorage.removeItem(key);
          value = legacy;
        }
      } catch {
        // Migration must never crash a read; the caller just sees a miss.
      }
    }
    return value;
  },

  setItem: async (key, value) => {
    if (value != null && value.length > SIZE_WARN_BYTES) {
      console.warn(
        `[secureStorage] value for "${key}" is ${value.length} bytes (> ${SIZE_WARN_BYTES}); consider trimming what is persisted`
      );
    }
    return SecureStore.setItemAsync(key, value, opts);
  },

  removeItem: (key) => SecureStore.deleteItemAsync(key, opts),
};

export default secureStorage;
