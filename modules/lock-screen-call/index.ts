/**
 * LockScreenCall JS API — Android-only, lets the app draw its incoming-call
 * screen over a locked device.
 *
 * `react-native-callkeep`'s displayIncomingCall() only registers the call
 * with Android's Telecom system — since we use a selfManaged
 * ConnectionService, Telecom draws no UI of its own, so nothing the user
 * can see appears unless the app itself brings its window to the front.
 * The library's own RNCallKeep.backToForeground() helper is unreliable for
 * this: it only applies the lock-screen-bypass window flags in the branch
 * where getCurrentReactActivity() is null — but a backgrounded-not-killed
 * app almost always still has a live Activity instance, so it takes the
 * other branch (plain foreground reorder, no lock-screen flags) every
 * time. Confirmed via a real device log: backToForeground() ran
 * ("app isOpened? true"), but nothing appeared on the locked screen.
 *
 * This module calls Activity#setShowWhenLocked / #setTurnScreenOn directly
 * — the current, non-deprecated APIs (the WindowManager flags the library
 * uses were deprecated in API 27) — and only while a call is actually
 * ringing. It's toggled off again as soon as the call is answered/declined/
 * ended, since leaving it on would let normal trip/earnings screens leak
 * over the lock screen at any other time.
 */
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type NativeModuleType = {
  showOverLockScreen(): void;
  clearShowOverLockScreen(): void;
};

const native =
  Platform.OS === 'android'
    ? requireOptionalNativeModule<NativeModuleType>('LockScreenCall')
    : null;

export const LockScreenCall = {
  /** False on iOS and on any binary built before this module was added. */
  isAvailable(): boolean {
    return native != null;
  },
  /** Call the instant an incoming call starts ringing. */
  show(): void {
    try { native?.showOverLockScreen(); } catch { /* noop */ }
  },
  /** Call the instant the call is answered, declined, or ends. */
  clear(): void {
    try { native?.clearShowOverLockScreen(); } catch { /* noop */ }
  },
};
