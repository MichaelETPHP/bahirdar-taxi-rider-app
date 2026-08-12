import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Easing, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Volume1, ChevronDown } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow, borderRadius } from '../../constants/layout';
import useCallStore from '../../store/callStore';
import { acceptIncomingCall, declineIncomingCall, endCall, toggleMute, toggleSpeaker } from '../../services/callEngine';

/** Rings with the device's own default ringtone on Android — a system
 * content:// URI any app can play, no special permission needed. iOS has
 * no equivalent API for third-party apps without CallKit (the full native
 * incoming-call framework, deliberately deferred), so it falls back to the
 * bundled call-ring sound there — a dedicated ringtone, not the trip-offer
 * alert reused from elsewhere in the app. */
function useIncomingRingSound(status) {
  const soundRef = useRef(null);

  useEffect(() => {
    if (status !== 'incoming') return;
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });

        let sound;
        if (Platform.OS === 'android') {
          try {
            ({ sound } = await Audio.Sound.createAsync(
              { uri: 'content://settings/system/ringtone' },
              { isLooping: true, volume: 1.0 }
            ));
          } catch (_) {
            // Some devices/ROMs reject the content:// ringtone URI — fall
            // back rather than ring silently.
            ({ sound } = await Audio.Sound.createAsync(
              require('../../../audio/call-ring.wav'),
              { isLooping: true, volume: 1.0 }
            ));
          }
        } else {
          ({ sound } = await Audio.Sound.createAsync(
            require('../../../audio/call-ring.wav'),
            { isLooping: true, volume: 1.0 }
          ));
        }

        if (cancelled) {
          sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
      } catch (_) {}
    })();

    return () => {
      cancelled = true;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [status]);
}

/** Ringback tone on the CALLER's side while waiting for the other person to
 * pick up — the "beep… beep…" a real phone plays back to you, not the
 * ringtone the callee hears. Plays through 'outgoing' and 'ringing' (once
 * the callee's app has ack'd and their phone is actually alerting) and
 * stops the instant either side moves past waiting. */
function useOutgoingRingbackSound(status) {
  const soundRef = useRef(null);

  useEffect(() => {
    if (status !== 'outgoing' && status !== 'ringing') return;
    let cancelled = false;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        console.log('[Call] ringback: audio mode set, loading dial tone…');
        const { sound } = await Audio.Sound.createAsync(
          require('../../../audio/dial-tone_us.mp3'),
          { isLooping: true, volume: 1.0 }
        );
        if (cancelled) {
          sound.unloadAsync().catch(() => {});
          return;
        }
        soundRef.current = sound;
        await sound.playAsync();
        console.log('[Call] ringback: playAsync resolved');
      } catch (err) {
        console.warn('[Call] ringback failed:', err?.message ?? err);
      }
    })();

    return () => {
      cancelled = true;
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) {
        sound.stopAsync().catch(() => {});
        sound.unloadAsync().catch(() => {});
      }
    };
  }, [status]);
}

const ENDED_LABELS = {
  declined: 'Call declined',
  busy: 'Still on another call',
  unavailable: 'Trip is no longer active',
  ended: 'Call ended',
  failed: "Couldn't connect",
};

function getInitials(name) {
  const initials = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  return initials || '?';
}

/** Same pulsing-ring language used across both apps' call buttons, sized to
 * match whatever avatar it wraps. Two staggered rings read as "live/ringing"
 * more clearly than one — closer to WhatsApp/iOS's incoming-call pulse. */
function RingPulse({ size, delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 1.35, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,     duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        ]),
        Animated.timing(scale,   { toValue: 1,   duration: 0, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 0, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ring,
        { width: size, height: size, borderRadius: size / 2, opacity, transform: [{ scale }] },
      ]}
    />
  );
}

function Avatar({ name, avatarUrl, size }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [avatarUrl]);

  if (avatarUrl && !failed) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: size / 2 }}
      />
    );
  }
  return (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={{ fontSize: size * 0.36, fontWeight: fontWeight.bold, color: colors.white }}>{getInitials(name)}</Text>
    </View>
  );
}

function useElapsedSeconds(connectedAt) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!connectedAt) return;
    setElapsed(Math.floor((Date.now() - connectedAt) / 1000));
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - connectedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [connectedAt]);
  return elapsed;
}

function formatDuration(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

/** Outgoing / ringing / incoming / connecting / ended — everything before
 * (or after) an established call. */
function RingingScreen({ status, peerName, peerAvatarUrl, endedReason, insets }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 240, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  const isIncoming = status === 'incoming';
  const isEnded = status === 'ended';
  const subtitle = isEnded
    ? (ENDED_LABELS[endedReason] || 'Call ended')
    : isIncoming
      ? 'Incoming voice call'
      : status === 'connecting'
        ? 'Connecting…'
        : status === 'ringing'
          ? 'Ringing…'
          : 'Calling…';

  const AVATAR_SIZE = 136;

  return (
    <Animated.View style={[styles.fullScreen, { opacity: fade, transform: [{ scale }] }]}>
      <View style={[styles.center, { paddingTop: insets.top + 48 }]}>
        <View style={[styles.avatarWrap, { width: AVATAR_SIZE, height: AVATAR_SIZE }]}>
          {!isEnded && (
            <>
              <RingPulse size={AVATAR_SIZE} />
              <RingPulse size={AVATAR_SIZE} delay={700} />
            </>
          )}
          <Avatar name={peerName} avatarUrl={peerAvatarUrl} size={AVATAR_SIZE} />
        </View>

        <Text style={styles.peerName}>{peerName}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {!isEnded && (
        <View style={[styles.buttonRow, { paddingBottom: insets.bottom + 40 }]}>
          {isIncoming ? (
            <>
              <View style={styles.actionCol}>
                <TouchableOpacity style={[styles.circleBtn, styles.declineBtn]} onPress={declineIncomingCall} activeOpacity={0.85}>
                  <PhoneOff size={26} color={colors.white} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Decline</Text>
              </View>
              <View style={styles.actionCol}>
                <TouchableOpacity style={[styles.circleBtn, styles.acceptBtn]} onPress={acceptIncomingCall} activeOpacity={0.85}>
                  <Phone size={24} color={colors.white} fill={colors.white} />
                </TouchableOpacity>
                <Text style={styles.actionLabel}>Accept</Text>
              </View>
            </>
          ) : (
            <View style={styles.actionCol}>
              <TouchableOpacity style={[styles.circleBtn, styles.declineBtn]} onPress={endCall} activeOpacity={0.85}>
                <PhoneOff size={26} color={colors.white} />
              </TouchableOpacity>
              <Text style={styles.actionLabel}>Cancel</Text>
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

/** Full-screen in-call UI — the primary connected state. Minimizes to
 * ConnectedPill so the rider can still see the map/trip while talking; a
 * real call can run for minutes, unlike the brief ringing phase. */
function ConnectedScreen({ peerName, peerAvatarUrl, isMuted, isSpeakerOn, insets }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const elapsed = useElapsedSeconds(useCallStore((s) => s.connectedAt));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 220, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.fullScreen, { opacity: fade, transform: [{ scale }] }]}>
      <TouchableOpacity
        style={[styles.minimizeBtn, { top: insets.top + 12 }]}
        onPress={() => useCallStore.getState().setMinimized(true)}
        activeOpacity={0.7}
        hitSlop={10}
      >
        <ChevronDown size={22} color="rgba(255,255,255,0.85)" />
      </TouchableOpacity>

      <View style={styles.center}>
        <View style={[styles.avatarWrap, { width: 108, height: 108 }]}>
          <Avatar name={peerName} avatarUrl={peerAvatarUrl} size={108} />
        </View>
        <Text style={styles.peerName}>{peerName}</Text>
        <Text style={styles.timer}>{formatDuration(elapsed)}</Text>
      </View>

      <View style={[styles.inCallControls, { paddingBottom: insets.bottom + 32 }]}>
        <View style={styles.toggleRow}>
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={[styles.toggleBtn, isMuted && styles.toggleBtnActive]}
              onPress={toggleMute}
              activeOpacity={0.8}
            >
              {isMuted ? <MicOff size={22} color={colors.white} /> : <Mic size={22} color={colors.white} />}
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
          </View>
          <View style={styles.actionCol}>
            <TouchableOpacity
              style={[styles.toggleBtn, isSpeakerOn && styles.toggleBtnActive]}
              onPress={toggleSpeaker}
              activeOpacity={0.8}
            >
              {isSpeakerOn ? <Volume2 size={22} color={colors.white} /> : <Volume1 size={22} color={colors.white} />}
            </TouchableOpacity>
            <Text style={styles.actionLabel}>Speaker</Text>
          </View>
        </View>

        <TouchableOpacity style={[styles.circleBtn, styles.declineBtn, styles.endBtnLarge]} onPress={endCall} activeOpacity={0.85}>
          <PhoneOff size={30} color={colors.white} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/** Compact floating pill shown when a connected call is minimized — tap to return to the full screen. */
function ConnectedPill({ peerName, isMuted, insets }) {
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  const elapsed = useElapsedSeconds(useCallStore((s) => s.connectedAt));

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[styles.pill, { top: insets.top + 10, opacity: fade, transform: [{ scale }] }]}>
      <TouchableOpacity
        style={styles.pillTapArea}
        onPress={() => useCallStore.getState().setMinimized(false)}
        activeOpacity={0.8}
      >
        <View style={styles.pillDot} />
        <View style={{ flex: 1 }}>
          <Text style={styles.pillName} numberOfLines={1}>{peerName}</Text>
          <Text style={styles.pillDuration}>{formatDuration(elapsed)} · Tap to return</Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.pillIconBtn} onPress={toggleMute} activeOpacity={0.75}>
        {isMuted ? <MicOff size={16} color={colors.white} /> : <Mic size={16} color={colors.white} />}
      </TouchableOpacity>
      <TouchableOpacity style={[styles.pillIconBtn, styles.pillEndBtn]} onPress={endCall} activeOpacity={0.75}>
        <PhoneOff size={16} color={colors.white} />
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function CallOverlay() {
  const insets = useSafeAreaInsets();
  const status = useCallStore((s) => s.status);
  const peerName = useCallStore((s) => s.peerName);
  const peerAvatarUrl = useCallStore((s) => s.peerAvatarUrl);
  const endedReason = useCallStore((s) => s.endedReason);
  const isMuted = useCallStore((s) => s.isMuted);
  const isSpeakerOn = useCallStore((s) => s.isSpeakerOn);
  const isMinimized = useCallStore((s) => s.isMinimized);

  useIncomingRingSound(status);
  useOutgoingRingbackSound(status);

  if (status === 'idle') return null;

  if (status === 'connected') {
    if (isMinimized) {
      return <ConnectedPill peerName={peerName} isMuted={isMuted} insets={insets} />;
    }
    return (
      <ConnectedScreen
        peerName={peerName}
        peerAvatarUrl={peerAvatarUrl}
        isMuted={isMuted}
        isSpeakerOn={isSpeakerOn}
        insets={insets}
      />
    );
  }

  return (
    <RingingScreen
      status={status}
      peerName={peerName}
      peerAvatarUrl={peerAvatarUrl}
      endedReason={endedReason}
      insets={insets}
    />
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 12, 16, 0.98)',
    justifyContent: 'space-between',
    zIndex: 100,
    elevation: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minimizeBtn: {
    position: 'absolute',
    left: 16,
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  avatarWrap: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  ring: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)',
  },
  peerName: {
    fontSize: 24, fontWeight: fontWeight.bold, color: colors.white, textAlign: 'center',
  },
  subtitle: {
    marginTop: 8, fontSize: fontSize.md, color: 'rgba(255,255,255,0.6)',
  },
  timer: {
    marginTop: 8, fontSize: fontSize.lg, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.5, fontVariant: ['tabular-nums'],
  },

  buttonRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 56,
  },
  actionCol: {
    alignItems: 'center', gap: 10,
  },
  actionLabel: {
    fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: fontWeight.medium,
  },
  circleBtn: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.lg,
  },
  acceptBtn: { backgroundColor: '#22C55E' },
  declineBtn: { backgroundColor: '#DC2626' },

  inCallControls: {
    alignItems: 'center', gap: 40,
  },
  toggleRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 40,
  },
  toggleBtn: {
    width: 54, height: 54, borderRadius: 27,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)',
  },
  endBtnLarge: {
    width: 72, height: 72, borderRadius: 36,
  },

  pill: {
    position: 'absolute',
    left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderRadius: borderRadius.pill,
    paddingVertical: 8, paddingHorizontal: 12,
    zIndex: 100, elevation: 100,
    ...shadow.lg,
  },
  pillTapArea: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  pillDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#22C55E',
  },
  pillName: {
    fontSize: 13, fontWeight: fontWeight.bold, color: colors.white,
  },
  pillDuration: {
    fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 1,
  },
  pillIconBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  pillEndBtn: {
    backgroundColor: '#DC2626',
  },
});
