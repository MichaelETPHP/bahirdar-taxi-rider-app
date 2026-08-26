/**
 * Shared call-audio helpers used by both the ringing UI (CallOverlay.js) and
 * the socket-listener attach point (callEngine.js). Pulled out to its own
 * module (not CallOverlay.js) specifically so callEngine.js can pre-warm the
 * ringtone early — importing straight from CallOverlay.js would create a
 * cycle, since CallOverlay.js already imports from callEngine.js.
 */
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';

/** Real-phone-call audio mode, shared by both the incoming ringtone and the
 * outgoing ringback tone: plays through the loud speaker (not the earpiece,
 * which would make a ring nearly inaudible unless the phone is held up),
 * ignores the iOS silent switch, takes priority over/doesn't get ducked by
 * whatever else might be holding audio focus, and keeps playing if the app
 * is briefly backgrounded. Every field is passed explicitly — expo-av's
 * setAudioModeAsync replaces the whole mode object rather than merging, so
 * an omitted field silently falls back to its SDK default, not to whatever
 * a previous call left behind. */
export async function setPhoneCallAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: true,
    interruptionModeIOS: InterruptionModeIOS.DoNotMix,
    shouldDuckAndroid: false,
    interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
    playThroughEarpieceAndroid: false,
  });
}

let cachedRingSound = null;
let cachedRingLoadPromise = null;

/**
 * Loads (but does not play) the incoming-ring sound once and caches it.
 * The ring screen appearing but the sound lagging behind it was traced to
 * this file read + decode happening fresh on every single incoming call,
 * right on the critical "call arrives → ring plays" path. Calling this
 * speculatively — as soon as the app is call-capable, well before any real
 * call ever arrives (see callEngine.js's attachCallSocketListeners) — moves
 * that cost off the critical path entirely; the real ring then just calls
 * replayAsync() on an already-decoded sound.
 */
export async function preloadRingSound() {
  if (cachedRingSound) return cachedRingSound;
  if (cachedRingLoadPromise) return cachedRingLoadPromise;
  cachedRingLoadPromise = (async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        require('../../audio/call-ring.wav'),
        { isLooping: true, volume: 1.0, shouldPlay: false }
      );
      cachedRingSound = sound;
      return sound;
    } catch (err) {
      console.warn('[Call] preloadRingSound failed:', err?.message ?? err);
      return null;
    } finally {
      cachedRingLoadPromise = null;
    }
  })();
  return cachedRingLoadPromise;
}

export function getCachedRingSound() {
  return cachedRingSound;
}
