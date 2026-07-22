/**
 * Device integrity detection — INSA: root/emulator detection (rider app).
 * jail-monkey wrapper: check at startup, cache for the session, re-check on
 * app resume. Local checks are visibility only — server-side Play Integrity
 * (driver app first) is the enforceable path; rider has no wallet UI.
 */
import { AppState, Platform } from 'react-native';
import JailMonkey from 'jail-monkey';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { apiRequest } from '../lib/apiClient';
import { computeRiskLevel } from './integrityPolicy';

let cached = null;
let monitoringStarted = false;
const listeners = new Set();

export async function checkDeviceIntegrity(force = false) {
  if (cached && !force) return cached;

  let flags;
  try {
    const [isDebuggedMode, rootedSecondary, mockLocationEnabled] = await Promise.all([
      JailMonkey.isDebuggedMode(),
      // Secondary root signal — different heuristics than jail-monkey, so a
      // bypass tool that fools one library can still trip the other.
      Device.isRootedExperimentalAsync().catch(() => false),
      Platform.OS === 'android'
        ? Promise.resolve(JailMonkey.canMockLocation()).catch(() => false)
        : Promise.resolve(false),
    ]);
    const isJailBroken = JailMonkey.isJailBroken() || rootedSecondary;
    flags = {
      isJailBroken,
      isRooted: isJailBroken,
      isOnExternalStorage: Platform.OS === 'android' ? JailMonkey.isOnExternalStorage() : false,
      isDebuggedMode,
      hookDetected: JailMonkey.hookDetected(),
      // Emulator only counts in production builds — local dev always runs in one
      isEmulator: !__DEV__ && !Device.isDevice,
      mockLocationEnabled,
    };
  } catch (e) {
    // Detection failure must never crash or lock out a legitimate user
    flags = {
      isJailBroken: false,
      isRooted: false,
      isOnExternalStorage: false,
      isDebuggedMode: false,
      hookDetected: false,
      isEmulator: false,
      mockLocationEnabled: false,
    };
  }

  cached = { ...flags, riskLevel: computeRiskLevel(flags), checkedAt: Date.now() };
  listeners.forEach((l) => l(cached));
  return cached;
}

export function getCachedIntegrity() {
  return cached;
}

export function onIntegrityChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * DEV-ONLY test hook — lets us verify the real block-screen/policy/logout-timer
 * path without needing physical rooted hardware. No-ops in release builds
 * (the __DEV__ guard is the only gate — there is no way to trigger this from
 * a production binary).
 */
export function __devSimulateRooted(rooted) {
  if (!__DEV__) return;
  const flags = rooted
    ? {
        isJailBroken: true,
        isRooted: true,
        isOnExternalStorage: false,
        isDebuggedMode: false,
        hookDetected: false,
        isEmulator: false,
        mockLocationEnabled: false,
      }
    : {
        isJailBroken: false,
        isRooted: false,
        isOnExternalStorage: false,
        isDebuggedMode: false,
        hookDetected: false,
        isEmulator: false,
        mockLocationEnabled: false,
      };
  cached = { ...flags, riskLevel: computeRiskLevel(flags), checkedAt: Date.now() };
  listeners.forEach((l) => l(cached));
}

export function startIntegrityMonitoring() {
  if (monitoringStarted) return;
  monitoringStarted = true;
  checkDeviceIntegrity();
  AppState.addEventListener('change', (state) => {
    if (state === 'active') checkDeviceIntegrity(true);
  });
}

/** Fire-and-forget report to the API (visibility only, requires auth). */
export async function reportIntegrityEvent(result) {
  if (!result || result.riskLevel === 'none') return;
  try {
    await apiRequest('POST', '/security/integrity-event', {
      risk_level: result.riskLevel,
      details: {
        isJailBroken: result.isJailBroken,
        isRooted: result.isRooted,
        isOnExternalStorage: result.isOnExternalStorage,
        isDebuggedMode: result.isDebuggedMode,
        hookDetected: result.hookDetected,
        isEmulator: result.isEmulator,
        mockLocationEnabled: result.mockLocationEnabled,
      },
      app_version: Constants.expoConfig?.version ?? undefined,
      platform: Platform.OS === 'android' ? 'android' : 'ios',
    });
  } catch (e) {
    // Never let telemetry break the app
  }
}
