import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { Image } from 'expo-image';
import { Marker } from 'react-native-maps';
import { colors } from '../../constants/colors';

const LABEL_GAP = 6;
const AVATAR_OUTER = 48;

/**
 * Premium Pulse Ring Component
 * Creates an expanding, fading circle effect.
 */
function PulseRing({ delay = 0 }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.2,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
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

export default React.memo(function UserMarker({ coordinate, avatarUrl, name, label, onDragEnd }) {
  const [imageReady, setImageReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragScale = useRef(new Animated.Value(1)).current;

  // Stop tracking after image loads to save performance
  useEffect(() => {
    const timer = setTimeout(() => {}, 3000);
    return () => clearTimeout(timer);
  }, [imageReady]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    Animated.spring(dragScale, {
      toValue: 1.3,
      useNativeDriver: true,
      tension: 100,
      friction: 6,
    }).start();
  }, [dragScale]);

  const handleDragEnd = useCallback((e) => {
    setIsDragging(false);
    Animated.spring(dragScale, {
      toValue: 1,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
    onDragEnd?.(e.nativeEvent.coordinate);
  }, [dragScale, onDragEnd]);

  if (!coordinate) return null;

  const initials = name
    ? name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : null;

  // On Android, we MUST track view changes while the image loads / animation plays
  // We keep it true for animations to look smooth
  const tracks = true; 

  // Anchor at center of avatar (below optional label) so lat/lng matches pickup point
  const anchor = label ? { x: 0.5, y: 0.72 } : { x: 0.5, y: 0.5 };

  return (
    <Marker
      coordinate={coordinate}
      tracksViewChanges={true}
      anchor={anchor}
      zIndex={99}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <Animated.View style={[styles.column, { transform: [{ scale: dragScale }] }]}>
        {label ? (
          <View style={styles.labelPill}>
            <Text style={styles.labelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        ) : null}

        <View style={styles.outer}>
          {/* Animated Pulse Rings */}
          <PulseRing delay={0} />
          <PulseRing delay={1000} />

          <View style={styles.ring} />
          <View style={styles.shellShadow}>
            <View style={styles.shell}>
              {avatarUrl ? (
                <Image
                  source={{ uri: avatarUrl }}
                  style={styles.avatar}
                  onLoad={() => setImageReady(true)}
                  cachePolicy="disk"
                />
              ) : initials ? (
                <View style={styles.initialsCircle}>
                  <Text style={styles.initialsText}>{initials}</Text>
                </View>
              ) : (
                <View style={styles.dot} />
              )}
            </View>
          </View>
        </View>
      </Animated.View>
    </Marker>
  );
});

const styles = StyleSheet.create({
  column: {
    alignItems: 'center',
  },
  labelPill: {
    maxWidth: 160,
    backgroundColor: colors.white,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: LABEL_GAP,
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  labelText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF0000',
  },
  outer: {
    width: AVATAR_OUTER,
    height: AVATAR_OUTER,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  ring: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: colors.primary,
    backgroundColor: `${colors.primary}25`,
  },
  shell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: 'hidden',
    backgroundColor: colors.primary,
  },
  shellShadow: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.white,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 17,
  },
  initialsCircle: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
  },
  initialsText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
    letterSpacing: 0.5,
  },
  dot: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 17,
  },
});
