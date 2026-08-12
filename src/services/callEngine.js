/**
 * In-app WebRTC voice call engine — imperative singleton, mirrors
 * socketService.js's pattern so it survives screen navigation (a React
 * hook tied to a trip screen would tear down mid-call every time the trip
 * advances from DriverMatched → DriverArrived → TripActive).
 *
 * STUN-only for now (Google's public servers) — no TURN server is
 * provisioned yet, so calls can fail to connect on restrictive/symmetric
 * NATs until coturn is running.
 */
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';
import { AppState } from 'react-native';
import { Audio } from 'expo-av';
import { getSocket } from './socketService';
import useCallStore from '../store/callStore';
import useRideStore from '../store/rideStore';
import { normalizeAvatarUrl } from '../utils/avatarUrl';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let pc = null;
let localStream = null;
let pendingOffer = null; // { trip_id, offer } while an incoming call is ringing, before accept
let boundSocket = null;  // the exact socket instance listeners are currently bound to

// ICE candidates arrive over the socket the moment the caller creates them —
// often seconds BEFORE this side has a peer connection (callee: pc isn't
// created until Accept is tapped) or before the remote description is set
// (caller: answer still in flight). addIceCandidate in either state is a
// dropped/failed candidate, and with them gone ICE can never pair the
// phones — the call sits at "Connecting…" forever. Buffer early arrivals
// and flush once the remote description lands.
let pendingRemoteCandidates = [];

async function flushPendingCandidates() {
  if (!pc || !pc.remoteDescription) return;
  const queued = pendingRemoteCandidates;
  pendingRemoteCandidates = [];
  for (const candidate of queued) {
    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch (_) {}
  }
}

// Safety valve: a Fast Refresh / JS reload mid-call can leave callStore's
// status stuck at a non-idle value forever (module state survives Fast
// Refresh even though the in-flight call is long gone) — every future
// incoming call would then get auto-rejected as "busy" with no way to
// recover short of a full app restart. Force back to idle if a call never
// reaches 'connected' within this window.
const CALL_WATCHDOG_MS = 45000;
let watchdogTimer = null;
let watchdogDeadline = null;

function forceIdle(reason) {
  console.warn(`[Call] Watchdog: ${reason}, forcing back to idle`);
  cleanupResources();
  useCallStore.getState().reset();
}

function armWatchdog() {
  clearWatchdog();
  watchdogDeadline = Date.now() + CALL_WATCHDOG_MS;
  watchdogTimer = setTimeout(() => forceIdle('call never connected in time'), CALL_WATCHDOG_MS);
}

function clearWatchdog() {
  if (watchdogTimer) {
    clearTimeout(watchdogTimer);
    watchdogTimer = null;
  }
  watchdogDeadline = null;
}

// Plain setTimeout can be throttled or paused while the app is backgrounded
// (especially iOS), so a stuck non-idle call state isn't guaranteed to clear
// at 45s wall-clock time if the app was suspended for part of that window —
// it could sit stuck (silently rejecting every incoming call as "busy")
// until the JS engine gets scheduling time again. Re-check the deadline
// directly against wall-clock time on every foreground resume as a backstop.
AppState.addEventListener('change', (next) => {
  if (next !== 'active') return;
  if (watchdogDeadline && Date.now() > watchdogDeadline) {
    forceIdle('resumed from background past the call deadline');
  }
});

function cleanupResources() {
  clearWatchdog();
  if (pc) {
    try { pc.close(); } catch (_) {}
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach((t) => t.stop());
    localStream = null;
  }
  pendingOffer = null;
  pendingRemoteCandidates = [];
}

async function getLocalStream() {
  if (localStream) return localStream;
  localStream = await mediaDevices.getUserMedia({ audio: true, video: false });
  return localStream;
}

function currentTripId() {
  return useCallStore.getState().tripId;
}

async function createPeerConnection(tripId) {
  // iceCandidatePoolSize makes gathering start the instant the peer
  // connection is constructed, instead of waiting for setLocalDescription()
  // to kick it off — so the ~300ms STUN round-trip overlaps with mic
  // init/addTrack/createOffer instead of running after them. Shaves real
  // time off the critical path to "connecting", confirmed via on-device
  // logs showing gathering only starting post-setLocalDescription before
  // this change.
  const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 1 });

  connection.addEventListener('icecandidate', (event) => {
    console.log('[Call] local icecandidate', event.candidate ? event.candidate.candidate : '(end of candidates)');
    if (event.candidate) {
      getSocket()?.emit('call:ice-candidate', { trip_id: tripId, candidate: event.candidate });
    }
  });

  connection.addEventListener('iceconnectionstatechange', () => {
    console.log('[Call] iceConnectionState →', connection.iceConnectionState);
  });

  connection.addEventListener('icegatheringstatechange', () => {
    console.log('[Call] iceGatheringState →', connection.iceGatheringState);
  });

  connection.addEventListener('connectionstatechange', () => {
    const state = connection.connectionState;
    console.log('[Call] connectionState →', state);
    if (state === 'connected') {
      clearWatchdog();
      useCallStore.getState().setStatus('connected');
    } else if (state === 'failed' || state === 'disconnected' || state === 'closed') {
      // 'closed' is usually just the echo of our own cleanupResources()
      // already having called pc.close() — the status-!=-idle guard below
      // makes that a harmless no-op. But some platforms can reach 'closed'
      // directly (skipping 'failed'/'disconnected' entirely) without us
      // ever having initiated it, which — before this — left useCallStore
      // stuck at 'connecting'/'connected' until the 45s watchdog eventually
      // forced it back to idle. Until then, startOutgoingCall()'s own
      // idle-check would silently reject every new call attempt with no
      // visible error — a plausible cause of "sometimes it just doesn't
      // work."
      if (useCallStore.getState().status !== 'idle') {
        getSocket()?.emit('call:end', { trip_id: tripId });
        cleanupResources();
        useCallStore.getState().setEnded('failed');
      }
    }
  });

  return connection;
}

export async function startOutgoingCall({ tripId, peerName, peerRole, peerAvatarUrl }) {
  const socket = getSocket();
  if (!socket || !tripId) return;
  if (useCallStore.getState().status !== 'idle') {
    // Was completely silent before — tapping "Call" looked like it did
    // nothing, with zero trace of why. Now logs the stuck status so a
    // repeat of this is immediately diagnosable instead of looking like a
    // dead button.
    console.warn('[Call] startOutgoingCall blocked, status not idle:', useCallStore.getState().status);
    return;
  }

  useCallStore.getState().setOutgoing({ tripId, peerName, peerRole, peerAvatarUrl });
  armWatchdog();

  try {
    // Requesting the mic (permission prompt + audio session init) can take
    // a few hundred ms even when already granted — run it alongside peer
    // connection setup instead of stacking after it, to get the offer out
    // (and the callee's phone actually ringing) sooner.
    const [connection, stream] = await Promise.all([createPeerConnection(tripId), getLocalStream()]);
    pc = connection;
    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const offer = await pc.createOffer();
    // createOffer() already produced the final SDP — setLocalDescription()
    // only applies that same content to our own pc, it doesn't change what
    // gets sent. Firing the emit in parallel instead of after it lets the
    // network round-trip and local SDP application overlap rather than
    // stack, shaving the callee's time-to-ring.
    await Promise.all([
      pc.setLocalDescription(offer),
      Promise.resolve(socket.emit('call:invite', { trip_id: tripId, offer })),
    ]);
    console.log('[Call] call:invite emitted', { tripId, connected: socket.connected, socketId: socket.id });
  } catch (err) {
    console.warn('[Call] startOutgoingCall failed:', err?.message ?? err);
    cleanupResources();
    useCallStore.getState().reset();
  }
}

export async function acceptIncomingCall() {
  if (!pendingOffer) return;
  const { trip_id, offer } = pendingOffer;
  const socket = getSocket();
  if (!socket) return;

  try {
    pc = await createPeerConnection(trip_id);
    // Same reasoning as above — the mic prompt overlaps with applying the
    // caller's offer instead of adding to the wait after it.
    const [, stream] = await Promise.all([
      pc.setRemoteDescription(new RTCSessionDescription(offer)),
      getLocalStream(),
    ]);
    await flushPendingCandidates();

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    const answer = await pc.createAnswer();
    pendingOffer = null;
    // Same reasoning as the offer side — createAnswer() already has the
    // final SDP, so send it while setLocalDescription() applies it locally
    // instead of after.
    await Promise.all([
      pc.setLocalDescription(answer),
      Promise.resolve(socket.emit('call:answer', { trip_id, answer })),
    ]);
    console.log('[Call] call:answer emitted', { trip_id, connected: socket.connected, socketId: socket.id });
    useCallStore.getState().setStatus('connecting');
  } catch (err) {
    console.warn('[Call] acceptIncomingCall failed:', err?.message ?? err);
    cleanupResources();
    useCallStore.getState().reset();
  }
}

export function declineIncomingCall() {
  const tripId = pendingOffer?.trip_id || currentTripId();
  if (tripId) getSocket()?.emit('call:decline', { trip_id: tripId });
  cleanupResources();
  useCallStore.getState().reset();
}

export function endCall() {
  const tripId = currentTripId();
  if (tripId) getSocket()?.emit('call:end', { trip_id: tripId });
  cleanupResources();
  useCallStore.getState().reset();
}

export function toggleMute() {
  const track = localStream?.getAudioTracks?.()[0];
  if (!track) return;
  track.enabled = !track.enabled;
  useCallStore.getState().setMuted(!track.enabled);
}

/**
 * Routes call audio to the loudspeaker vs. earpiece. `playThroughEarpieceAndroid`
 * is a real Android AudioManager-level switch (not just expo-av's own player),
 * so it does affect the WebRTC call audio without needing a native module —
 * but it's Android-only. iOS has no equivalent public API without CallKit, so
 * this is a no-op there; the button still updates so the UI stays consistent,
 * it just won't audibly change anything on an iPhone yet.
 */
export async function toggleSpeaker() {
  const next = !useCallStore.getState().isSpeakerOn;
  try {
    await Audio.setAudioModeAsync({ playThroughEarpieceAndroid: !next });
  } catch (_) {}
  useCallStore.getState().setSpeakerOn(next);
}

const CALL_EVENT_NAMES = [
  'call:invite', 'call:ringing', 'call:answer', 'call:ice-candidate',
  'call:decline', 'call:busy', 'call:end', 'call:unavailable',
];

/**
 * Binds call-signaling listeners to the current socket. Safe to call any
 * number of times (e.g. every time RootNavigator reconnects, or on every
 * Fast Refresh hot-reload during dev) — explicit .off() before every .on()
 * below means repeated calls never accumulate duplicate listeners.
 */
export function attachCallSocketListeners() {
  const socket = getSocket();
  if (!socket) {
    console.log('[Call] attachCallSocketListeners: no socket yet, skipping bind');
    return;
  }
  boundSocket = socket;
  console.log('[Call] attachCallSocketListeners bound', { connected: socket.connected, socketId: socket.id });

  // Explicit .off() before every .on(), regardless of the boundSocket
  // fast-path above: Fast Refresh resets this module's `boundSocket` to
  // null on every hot-reload while the underlying socket connection often
  // survives untouched, so relying on that guard alone let duplicate
  // listeners accumulate across dev reloads. Each extra listener replayed
  // 'call:invite' a second time, saw the store already flipped to
  // 'incoming' by the first one, and fired 'call:busy' back at the caller
  // — "still on another call" even though the callee was free and the call
  // was visibly ringing on their screen. socket.off(event) with no handler
  // clears every listener for that event, making this safe to call any
  // number of times.
  CALL_EVENT_NAMES.forEach((event) => socket.off(event));

  socket.on('call:invite', ({ trip_id, offer, from_role }) => {
    console.log('[Call] call:invite received', { trip_id, from_role, currentStatus: useCallStore.getState().status });
    if (useCallStore.getState().status !== 'idle') {
      socket.emit('call:busy', { trip_id });
      return;
    }
    pendingOffer = { trip_id, offer };
    // The driver's name/photo aren't sent over signaling — both are already
    // sitting in this app's matched-driver data from when the trip was
    // matched. Falls back to a generic label only if that data is somehow
    // missing (e.g. call:invite arriving before the trip finished loading).
    const ride = useRideStore.getState();
    const driver = ride.tripId === trip_id ? ride.driver : null;
    const rawAvatarUrl = driver?.avatar_url || driver?.avatarUrl || driver?.photoUrl || driver?.photo_url || driver?.profile_image || null;
    // Admin support calls have no driver profile to pull from (and may be
    // about a trip that's no longer the active one, or already completed),
    // so they get their own fixed label instead of falling through to the
    // generic driver/rider guess below.
    const peerName = from_role === 'admin'
      ? 'Bahiran Ride Support'
      : (driver?.name || driver?.full_name || (from_role === 'driver' ? 'Your driver' : 'Your rider'));
    useCallStore.getState().setIncoming({
      tripId: trip_id,
      peerRole: from_role,
      peerName,
      peerAvatarUrl: from_role === 'admin' ? null : (rawAvatarUrl ? normalizeAvatarUrl(rawAvatarUrl) : null),
    });
    armWatchdog();
    // Ack back to the caller the instant our UI actually starts ringing,
    // so their screen can move from "Calling…" to "Ringing…" — matching
    // the WhatsApp-style distinction between "reaching the server" and
    // "the other phone is now alerting."
    socket.emit('call:ringing', { trip_id });
  });

  socket.on('call:ringing', ({ trip_id }) => {
    const state = useCallStore.getState();
    if (state.status === 'outgoing' && state.tripId === trip_id) {
      state.setStatus('ringing');
    }
  });

  socket.on('call:answer', async ({ answer }) => {
    if (!pc) return;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
      await flushPendingCandidates();
    } catch (_) {}
  });

  socket.on('call:ice-candidate', async ({ candidate }) => {
    if (!candidate) return;
    if (!pc || !pc.remoteDescription) {
      console.log('[Call] remote icecandidate queued (no remoteDescription yet)', candidate.candidate);
      pendingRemoteCandidates.push(candidate);
      return;
    }
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
      console.log('[Call] remote icecandidate applied', candidate.candidate);
    } catch (err) {
      console.warn('[Call] remote icecandidate failed', err?.message ?? err);
    }
  });

  socket.on('call:decline', () => {
    if (useCallStore.getState().status === 'idle') return;
    cleanupResources();
    useCallStore.getState().setEnded('declined');
  });

  socket.on('call:busy', () => {
    cleanupResources();
    useCallStore.getState().setEnded('busy');
  });

  socket.on('call:end', () => {
    if (useCallStore.getState().status === 'idle') return;
    cleanupResources();
    useCallStore.getState().setEnded('ended');
  });

  socket.on('call:unavailable', () => {
    cleanupResources();
    useCallStore.getState().setEnded('unavailable');
  });
}
