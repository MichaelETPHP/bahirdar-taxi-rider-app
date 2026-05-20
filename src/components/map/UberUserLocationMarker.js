import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Animated, Easing, Platform, Image } from 'react-native';
import { Marker } from 'react-native-maps';
import { colors } from '../../constants/colors';

const OUTER_SIZE = 48;
const SHELL_SIZE = 34;

function PulseRing({ delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: false }),
          Animated.timing(opacity, { toValue: 0.55, duration: 0, useNativeDriver: false }),
        ]),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [delay, scale, opacity]);

  return (
    <Animated.View
      style={[
        styles.pulseRing,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
}

function UberUserLocationMarker({ coordinate, avatarUrl, animated = true }) {
  const [imageReady, setImageReady] = useState(false);

  useEffect(() => {
    setImageReady(false);
  }, [avatarUrl]);

  if (!coordinate) return null;

  return (
    <Marker
      coordinate={coordinate}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={99999}
      flat={false}
      tracksViewChanges={Platform.OS === 'android' ? true : !imageReady}
    >
      <View style={styles.column} collapsable={false} pointerEvents="none">
        <View style={styles.outer}>
          <PulseRing delay={0} />
          <PulseRing delay={900} />

          <View style={styles.ring} />

          <View style={styles.shellShadow}>
            <View style={styles.shell}>
              {avatarUrl ? (
                <Image
                  key={avatarUrl}
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  resizeMode="cover"
                  onLoad={() => setImageReady(true)}
                  onError={() => setImageReady(false)}
                />
              ) : (
                <View style={styles.fallbackDot} />
              )}
            </View>
          </View>
        </View>
      </View>
    </Marker>
  );
}

export default React.memo(UberUserLocationMarker);

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
  },
  outer: {
    width: OUTER_SIZE,
    height: OUTER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.mapCurrentLocation,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: colors.mapCurrentLocation,
    backgroundColor: `${colors.mapCurrentLocation}22`,
  },
  shellShadow: {
    width: SHELL_SIZE,
    height: SHELL_SIZE,
    borderRadius: SHELL_SIZE / 2,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.24,
    shadowRadius: 3.84,
  },
  shell: {
    width: SHELL_SIZE - 4,
    height: SHELL_SIZE - 4,
    borderRadius: (SHELL_SIZE - 4) / 2,
    overflow: 'hidden',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 1000,
  },
  fallbackDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mapCurrentLocation,
  },
});
