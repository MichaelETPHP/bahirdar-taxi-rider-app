/**
 * Native call UI (CallKit on iOS, ConnectionService on Android) — Phase 1
 * of the full "rings like a real phone call" build. This phase covers the
 * app backgrounded-but-alive case (the live socket event already reaches
 * it): instead of our custom JS ringing screen, the OS's own incoming-call
 * UI shows, works over the lock screen, and answers/declines through the
 * system.
 *
 * NOT yet covered (needs its own phase): a fully killed app. That requires
 * PushKit (iOS) to wake the process before CallKit can display anything —
 * blocked on an Apple VoIP Services certificate — and an Android headless
 * JS task triggered from a data push for the same "killed app" case there.
 *
 * `selfManaged: true` on Android — this app draws no call UI of its own
 * via the system Phone app; it registers as a self-managed ConnectionService
 * account instead (the standard mode for VoIP apps like WhatsApp that don't
 * want to become the device's default dialer).
 */
import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import useCallStore from '../store/callStore';
import { acceptIncomingCall, declineIncomingCall, endCall as engineEndCall, toggleMute } from './callEngine';

const APP_NAME = 'Bahiran Ride';

// react-native-callkeep constructs a NativeEventEmitter at import time
// (react-native-callkeep/actions.js, module top-level), which throws
// "requires a non-null argument" the instant the native module isn't
// linked yet — an old installed build, Expo Go, or JS shipped via OTA to a
// device that hasn't downloaded the matching native rebuild from the store.
// Deferring the require() until the native module is confirmed present
// avoids a hard crash in all of those cases.
const RNCallKeep =
  Platform.OS !== 'web' && NativeModules.RNCallKeep ? require('react-native-callkeep').default : null;

let isSetUp = false;
let currentCallUUID = null;
let currentCallDirection = null; // 'outgoing' | 'incoming' | null
let lastHandledStatus = 'idle';
let lastHandledSpeaker = false;
let lastHandledMuted = false;

// useCallStore is a module-level singleton that survives Fast Refresh even
// when THIS file gets hot-reloaded — but a plain module-level `let` here
// does NOT survive that reload (it resets to null), so tracking the
// unsubscribe function that way can only ever clean up a subscription
// registered by the CURRENT module instance, never ones left behind by
// EARLIER reloads. Confirmed on-device: even after adding that guard,
// RNCallKeepModule.displayIncomingCall still fired twice for one call.
// globalThis is the one thing that actually persists across every reload
// of this file, so it's the only place cleanup can reliably reach back to
// whatever the previous instance (however many reloads ago) left behind —
// the same guarantee `socket.off(event)` gets for free from operating on
// the shared socket object instead of a per-instance handle.
const globalScope = globalThis;

function generateUuid() {
  // Only needs to be unique per call session, not cryptographically
  // random — avoids pulling in expo-crypto as a new native dependency
  // just for this.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function setupCallKeep() {
  if (isSetUp || Platform.OS === 'web' || !RNCallKeep) return;

  // react-native-callkeep never actually requests Android's dangerous
  // permissions itself — `additionalPermissions` in IOptions is a no-op on
  // Android (verified: not read anywhere in RNCallKeepModule.java), and in
  // selfManaged mode the library's own internal permission-gate list is
  // hardcoded down to just RECORD_AUDIO (`hasPermissions()` only checks
  // that one here). But the real Android Telecom framework enforces its
  // own requirements regardless of what the library thinks it needs:
  //   - VoiceConnectionService.createConnection() (incoming calls) calls
  //     TelecomManager.getPhoneAccount() unconditionally — needs
  //     READ_PHONE_NUMBERS, confirmed via a real crash log on-device.
  //   - RNCallKeepModule.startCall() (outgoing calls) calls
  //     TelecomManager.placeCall() unconditionally once past the library's
  //     own (too-lenient) hasPermissions() gate — needs CALL_PHONE.
  //   - listenToNativeCallsState()/checkIsInManagedCall() gate on
  //     READ_PHONE_STATE themselves (no crash risk either way), but
  //     silently no-op without it, breaking native call-state sync.
  // All three must be requested here ourselves before setup() — the
  // library provides no mechanism that actually does this.
  if (Platform.OS === 'android') {
    try {
      await PermissionsAndroid.requestMultiple([
        'android.permission.READ_PHONE_NUMBERS',
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      ]);
    } catch (err) {
      console.warn('[CallKeep] permission request failed:', err);
    }
  }

  try {
    await RNCallKeep.setup({
      ios: {
        appName: APP_NAME,
        supportsVideo: false,
        maximumCallGroups: '1',
        maximumCallsPerCallGroup: '1',
        includesCallsInRecents: false,
      },
      android: {
        alertTitle: 'Calling permission required',
        alertDescription: `${APP_NAME} needs access to your phone accounts to show incoming call alerts.`,
        cancelButton: 'Cancel',
        okButton: 'OK',
        // Not actually read by RNCallKeepModule.java on Android (verified —
        // no reference to it anywhere in the native source) — kept only
        // because it's harmless and the real request happens explicitly
        // above via PermissionsAndroid before setup() is called.
        additionalPermissions: ['android.permission.READ_PHONE_NUMBERS'],
        selfManaged: true,
        foregroundService: {
          channelId: 'com.bahirdar.rider.callkeep',
          channelName: 'Call status',
          notificationTitle: `${APP_NAME} — call in progress`,
        },
      },
    });
    if (Platform.OS === 'android') RNCallKeep.setAvailable(true);
    isSetUp = true;
  } catch (err) {
    console.warn('[CallKeep] setup failed:', err);
    return;
  }

  registerNativeEventHandlers();
  subscribeToCallStore();
}

function registerNativeEventHandlers() {
  if (!RNCallKeep) return;
  // Same duplicate-registration risk as the store subscription below —
  // addEventListener uses a plain NativeEventEmitter under the hood, which
  // stacks listeners on repeated calls with no built-in idempotency guard.
  RNCallKeep.removeEventListener('answerCall');
  RNCallKeep.removeEventListener('endCall');
  RNCallKeep.removeEventListener('didPerformSetMutedCallAction');
  RNCallKeep.addEventListener('answerCall', () => {
    acceptIncomingCall();
  });

  RNCallKeep.addEventListener('endCall', () => {
    const status = useCallStore.getState().status;
    if (status === 'incoming') {
      declineIncomingCall();
    } else if (status !== 'idle') {
      engineEndCall();
    }
  });

  RNCallKeep.addEventListener('didPerformSetMutedCallAction', ({ muted }) => {
    // The native button already flipped the OS-side mute indicator; sync
    // our actual WebRTC track to match rather than double-toggling.
    if (useCallStore.getState().isMuted !== muted) toggleMute();
  });
}

/**
 * Drives the native call UI from our existing call state machine — this
 * is the only place that calls displayIncomingCall/startCall/endCall, so
 * the native UI always mirrors whatever useCallStore already says.
 */
function subscribeToCallStore() {
  if (!RNCallKeep) return;
  globalScope.__callKeepStoreUnsub?.();
  globalScope.__callKeepStoreUnsub = useCallStore.subscribe((state) => {
    // Speaker/mute are independent of `status` — synced here, before the
    // status-transition guard below, since that guard early-returns
    // whenever status hasn't changed and would otherwise skip these on
    // every toggle. Previously the speaker button only touched expo-av's
    // software audio mode, which real Telecom-integrated calls don't
    // route through — CallKeep's own ConnectionService/CallKit manages
    // the actual call audio routing independently, so that toggle changed
    // nothing audible once a real native call was active. This calls the
    // real native route switch instead.
    if (Platform.OS === 'android' && state.isSpeakerOn !== lastHandledSpeaker) {
      lastHandledSpeaker = state.isSpeakerOn;
      if (currentCallUUID) RNCallKeep.toggleAudioRouteSpeaker(currentCallUUID, state.isSpeakerOn);
    }
    if (Platform.OS === 'ios' && state.isMuted !== lastHandledMuted) {
      lastHandledMuted = state.isMuted;
      // setMutedCall is iOS-only — Android mute is handled entirely by
      // callEngine.js disabling the local WebRTC audio track directly,
      // which needs no native sync since it's not routed through Telecom.
      if (currentCallUUID) RNCallKeep.setMutedCall(currentCallUUID, state.isMuted);
    }

    if (state.status === lastHandledStatus) return;
    const prevStatus = lastHandledStatus;
    lastHandledStatus = state.status;

    if (state.status === 'incoming' && prevStatus === 'idle') {
      currentCallUUID = generateUuid();
      currentCallDirection = 'incoming';
      RNCallKeep.displayIncomingCall(currentCallUUID, state.peerName, state.peerName, 'generic', false);
      // displayIncomingCall() only tells Android's Telecom system about the
      // call — it draws no UI itself since we're selfManaged. Without this,
      // our own React UI updates correctly in the background but the
      // Activity's window never actually shows over a locked screen, so
      // nothing is visibly/audibly perceptible despite everything else
      // working (confirmed via device log: displayIncomingCall fired, ICE
      // candidates arrived, but nothing appeared on a locked screen).
      if (Platform.OS === 'android') RNCallKeep.backToForeground();
      return;
    }

    if (state.status === 'outgoing' && prevStatus === 'idle') {
      currentCallUUID = generateUuid();
      currentCallDirection = 'outgoing';
      RNCallKeep.startCall(currentCallUUID, state.peerName, state.peerName, 'generic', false);
      return;
    }

    if (state.status === 'connected' && currentCallUUID) {
      RNCallKeep.setCurrentCallActive(currentCallUUID);
      if (Platform.OS === 'ios' && currentCallDirection === 'outgoing') {
        RNCallKeep.reportConnectedOutgoingCallWithUUID(currentCallUUID);
      }
      return;
    }

    if ((state.status === 'idle' || state.status === 'ended') && currentCallUUID) {
      const reason = state.status === 'ended' ? CALL_END_REASON_REMOTE : CALL_END_REASON_UNANSWERED;
      RNCallKeep.reportEndCallWithUUID(currentCallUUID, reason);
      currentCallUUID = null;
      currentCallDirection = null;
    }
  });
}

// From RNCallKeep.CONSTANTS.END_CALL_REASONS — inlined so this file doesn't
// need the CONSTANTS export just for two numbers.
const CALL_END_REASON_REMOTE = 2;
const CALL_END_REASON_UNANSWERED = 3;
