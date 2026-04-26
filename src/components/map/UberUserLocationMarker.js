import { memo, useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Marker } from 'react-native-maps';
import { colors } from '../../constants/colors';

/**
 * Elegant User Location Marker with Wave Animation
 * - Prominent profile picture (60px) at current location
 * - Sophisticated organic wave animation
 * - Minimalist luxury aesthetic
 * - Multiple ripple waves at staggered intervals
 */
function UberUserLocationMarker({
  coordinate,
  avatarUrl,
  animated = true,
}) {
  const wave1Anim = useRef(new Animated.Value(0)).current;
  const wave2Anim = useRef(new Animated.Value(0)).current;
  const wave3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    // Wave 1 - immediate start
    const wave1 = Animated.loop(
      Animated.sequence([
        Animated.timing(wave1Anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(wave1Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Wave 2 - 600ms delay
    const wave2 = Animated.loop(
      Animated.sequence([
        Animated.timing(wave2Anim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(wave2Anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(wave2Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    // Wave 3 - 1200ms delay
    const wave3 = Animated.loop(
      Animated.sequence([
        Animated.timing(wave3Anim, {
          toValue: 0,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(wave3Anim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(wave3Anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    wave1.start();
    wave2.start();
    wave3.start();

    return () => {
      wave1.stop();
      wave2.stop();
      wave3.stop();
    };
  }, [animated, wave1Anim, wave2Anim, wave3Anim]);

  // Create wave scale and opacity interpolations
  const createWaveInterpolations = (animValue) => ({
    scale: animValue.interpolate({
      inputRange: [0, 1],
      outputRange: [1, 2.2],
    }),
    opacity: animValue.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0.8, 0.4, 0],
    }),
  });

  const wave1 = createWaveInterpolations(wave1Anim);
  const wave2 = createWaveInterpolations(wave2Anim);
  const wave3 = createWaveInterpolations(wave3Anim);

  return (
    <Marker
      coordinate={coordinate}
      tracksViewChanges={true}
      zIndex={101}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.container}>
        {/* Wave rings - elegant ripple animation */}
        <Animated.View
          style={[
            styles.waveRing,
            {
              transform: [{ scale: wave1.scale }],
              opacity: wave1.opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            {
              transform: [{ scale: wave2.scale }],
              opacity: wave2.opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.waveRing,
            {
              transform: [{ scale: wave3.scale }],
              opacity: wave3.opacity,
            },
          ]}
        />

        {/* Profile picture container - main element */}
        <View style={styles.profileContainer}>
          <View style={styles.profileRing}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.profileImage}
                contentFit="cover"
                transition={200}
                cachePolicy="none"
              />
            ) : (
              <View style={styles.profilePlaceholder} />
            )}
          </View>
        </View>

        {/* Subtle accuracy indicator */}
        <View style={styles.accuracyRing} />
      </View>
    </Marker>
  );
}

export default memo(UberUserLocationMarker);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 120,
    height: 120,
  },

  // ── Wave rings - elegant ripple effect
  waveRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: colors.primary,
    top: 16,
    left: 16,
  },

  // ── Profile picture container - minimalist luxury
  profileContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  profileRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    // Elegant shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 15,
  },

  profileImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },

  profilePlaceholder: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F5F4F0',
  },

  // ── Subtle accuracy indicator
  accuracyRing: {
    position: 'absolute',
    width: 104,
    height: 104,
    borderRadius: 52,
    borderWidth: 1,
    borderColor: `${colors.primary}15`,
    top: 8,
    left: 8,
  },
});
