/**
 * notifee-backed full-screen call notification — pulled into its own module
 * (not backgroundCallTask.js or callKeepService.js) specifically so both of
 * those can use it without importing each other: backgroundCallTask.js posts
 * it when a call push arrives, callKeepService.js clears it once the call
 * stops being 'incoming' (answered/declined/ended/missed), and neither
 * needs to depend on the other to do that.
 */
import { Platform } from 'react-native';

// v3, not v1: Android notification channels are immutable once created on a
// device — the old 'call-invites-v1' channel already exists out there with
// the default notification sound, and its sound can never be changed
// programmatically. A new id is the only way to ship the real ringtone.
const CALL_NOTIFICATION_CHANNEL_ID = 'call-invites-v3';

function callNotificationId(tripId) {
  return `call-${tripId}`;
}

// notifee constructs native bridges at import time the same way
// react-native-callkeep does (see callKeepService.js) — deferring the
// require() until actually needed avoids a hard crash on any installed
// build/OTA combo that predates this native module being linked.
function getNotifee() {
  if (Platform.OS !== 'android') return null;
  try {
    return require('@notifee/react-native');
  } catch (err) {
    console.warn('[CallNotification] @notifee/react-native not available:', err?.message ?? err);
    return null;
  }
}

/**
 * Posts a real Android full-screen call notification (category: CALL +
 * fullScreenAction) — this is what actually launches the app straight to
 * the ring screen, over the lock screen, WITHOUT the rider tapping anything
 * first. Needs android.permission.USE_FULL_SCREEN_INTENT (declared in
 * app.config.js); some OEMs (Samsung included) may still require the rider
 * to grant it once via Settings, which no code can bypass — that's OS
 * policy, not a bug here.
 */
export async function showFullScreenCallNotification({ tripId, peerName }) {
  const notifeeModule = getNotifee();
  if (!notifeeModule) return;
  try {
    const notifee = notifeeModule.default;
    const { AndroidCategory, AndroidImportance, AndroidVisibility, AndroidFlags } = notifeeModule;
    const channelId = await notifee.createChannel({
      id: CALL_NOTIFICATION_CHANNEL_ID,
      name: 'Incoming Calls',
      importance: AndroidImportance.HIGH,
      // The app's own call-ring sound, bundled into res/raw (see
      // app.config.js's expo-notifications `sounds`). The OS plays this the
      // instant the notification posts — no JS boot, no audio focus, works
      // on the lock screen and for a fully killed app. This IS the ringtone
      // for the killed/background case; the in-app expo-av ringtone only
      // takes over once the app is foregrounded (CallOverlay cancels this
      // notification at that point, which also stops this sound).
      sound: 'call_ring',
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      vibration: true,
      // All values must be positive (no leading 0) — notifee's validator
      // rejects `[0, 300, ...]` outright, which was silently killing
      // createChannel() and with it the entire notification (confirmed
      // on-device: "expected an array containing an even number of
      // positive values").
      vibrationPattern: [100, 300, 200, 300],
    });

    await notifee.displayNotification({
      id: callNotificationId(tripId),
      title: `Incoming call — ${peerName}`,
      body: 'Tap to answer',
      android: {
        channelId,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        ongoing: true,
        autoCancel: false,
        sound: 'call_ring',
        // Ring like a phone, not a message: keep repeating the sound until
        // the notification is answered/declined/cancelled instead of
        // playing it once. FLAG_INSISTENT is the OS-level "this is a call,
        // keep ringing" switch.
        loopSound: true,
        flags: [AndroidFlags.FLAG_INSISTENT],
        // Handled natively by Android (AlarmManager), not by any JS still
        // running — matters because this notification can outlive the
        // background task that posted it. Without this, a rider whose app
        // genuinely can't finish booting (no network, corrupted state, an
        // unrelated crash) would have a phone ringing FLAG_INSISTENT
        // forever with nothing to stop it. Slightly past the caller's own
        // 45s watchdog so a real, in-progress call is never cut short here.
        timeoutAfter: 50_000,
        fullScreenAction: { id: 'default' },
        pressAction: { id: 'default', launchActivity: 'default' },
      },
    });
  } catch (err) {
    console.warn('[CallNotification] showFullScreenCallNotification failed:', err?.message ?? err);
  }
}

/** Clears the full-screen call notification once the call is no longer
 * ringing — called from callKeepService.js's store subscription, the one
 * place that already tracks every way a call can stop being 'incoming'. */
export async function clearCallNotification(tripId) {
  const notifeeModule = getNotifee();
  if (!notifeeModule || !tripId) return;
  try {
    await notifeeModule.default.cancelNotification(callNotificationId(tripId));
  } catch (_) { /* already cleared, or never shown — fine either way */ }
}

// Registering a background event handler is required by notifee's own API
// (it warns otherwise) — the notification's launchActivity already opens the
// app on its own, so there's nothing further to do here; the app's normal
// call:invite/pending-invite handling takes over once it boots.
const notifeeModule = getNotifee();
if (notifeeModule) {
  try {
    notifeeModule.default.onBackgroundEvent(async () => {});
  } catch (_) { /* non-fatal */ }
}
