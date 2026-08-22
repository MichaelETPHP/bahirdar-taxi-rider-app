import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Text } from 'react-native';
import { Image } from 'expo-image';
import * as Updates from 'expo-updates';
import { colors } from '../../constants/colors';

const COUNTDOWN_SECONDS = 3;

/**
 * Mandatory, full-screen takeover shown the instant a downloaded OTA update
 * is safe to apply (see App.js: only rendered when no ride/call is active).
 * Nothing behind it is reachable — no back gesture, no dismiss — because by
 * the time this shows, waiting is the only thing left to do: the countdown
 * always ends in reloadAsync(). Reuses SplashLoader's brand treatment (same
 * splash image + dark overlay) so this reads as a continuation of the app's
 * own loading language, not a foreign system dialog.
 */
export default function UpdatingScreen() {
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS);
  const [reloading, setReloading] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (secondsLeft <= 0) {
      setReloading(true);
      Updates.reloadAsync().catch(() => {});
      return;
    }
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // One small, deliberate pulse per tick — confirms the countdown is alive
  // without looping motion the whole time it's on screen.
  useEffect(() => {
    pulse.setValue(0.85);
    Animated.timing(pulse, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [secondsLeft, pulse]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/splash.png')}
        style={styles.backgroundImage}
        contentFit="cover"
        priority="high"
      />
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Animated.View style={[styles.badge, { transform: [{ scale: pulse }] }]}>
            <Text style={styles.badgeText}>{reloading ? '' : secondsLeft}</Text>
          </Animated.View>
          <Text style={styles.title}>Updating App</Text>
          <Text style={styles.subtitle}>
            {reloading ? 'Almost there…' : 'Applying the latest improvements'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
    elevation: 10000,
    backgroundColor: colors.primary,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderWidth: 2,
    borderColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  badgeText: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.white,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.2,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'center',
  },
});
