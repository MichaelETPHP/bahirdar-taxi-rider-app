import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, Dimensions, Linking, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';
import { fontSize, fontWeight } from '../../constants/typography';
import { Phone } from 'lucide-react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIZE = 66;
const HALF = SIZE / 2;
const START_X = SCREEN_WIDTH - HALF - 16;
const START_Y = SCREEN_HEIGHT / 2;
const TAP_THRESHOLD = 25;

export default function MovableCircleButton() {
  const [position, setPosition] = useState({ x: START_X, y: START_Y });
  const posRef = useRef(position);
  const dragStart = useRef({ x: START_X, y: START_Y });
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;
  posRef.current = position;

  useEffect(() => {
    // Continuous ringing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -1, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 1, duration: 100, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 100, useNativeDriver: true }),
        Animated.delay(1200),
      ])
    ).start();
  }, []);

  const playBounce = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.85,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 300,
        friction: 8,
      }),
    ]).start();
  };

  const handleCallCenter = async () => {
    playBounce();
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Linking.openURL('tel:9040').catch(() => {
      Alert.alert('Error', 'Unable to open phone dialer.');
    });
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragStart.current = { ...posRef.current };
      },
      onPanResponderMove: (_, { dx, dy }) => {
        setPosition({
          x: dragStart.current.x + dx,
          y: dragStart.current.y + dy,
        });
      },
      onPanResponderRelease: (_, { dx, dy }) => {
        const moved = Math.sqrt(dx * dx + dy * dy);
        if (moved < TAP_THRESHOLD) {
          handleCallCenter();
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          const newX = dragStart.current.x + dx;
          const newY = dragStart.current.y + dy;
          const clampedX = Math.max(HALF, Math.min(SCREEN_WIDTH - HALF, newX));
          const clampedY = Math.max(HALF, Math.min(SCREEN_HEIGHT - HALF, newY));
          setPosition({ x: clampedX, y: clampedY });
        }
      },
    })
  ).current;

  const rotateIcon = shakeAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-15deg', '15deg'],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.circle,
        {
          left: position.x - HALF,
          top: position.y - HALF,
          transform: [{ scale: scaleAnim }],
        },
      ]}
    >
      <Animated.View style={{ transform: [{ rotate: rotateIcon }] }}>
        <Phone size={20} color={colors.white} strokeWidth={3} />
      </Animated.View>
      <View style={styles.pulseContainer}>
        <Text style={styles.sosText}>9040</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  circle: {
    position: 'absolute',
    left: -HALF,
    top: -HALF,
    width: SIZE,
    height: SIZE,
    borderRadius: HALF,
    backgroundColor: colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 1,
    ...shadow.md,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  pulseContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosText: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: 0.5,
  },
});
