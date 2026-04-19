import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, Dimensions, Linking, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { shadow } from '../../constants/layout';
import { fontSize, fontWeight } from '../../constants/typography';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SIZE = 56;
const HALF = SIZE / 2;
const START_X = SCREEN_WIDTH - HALF - 16;
const START_Y = SCREEN_HEIGHT / 2;
const TAP_THRESHOLD = 25;

export default function MovableCircleButton() {
  const [position, setPosition] = useState({ x: START_X, y: START_Y });
  const posRef = useRef(position);
  const dragStart = useRef({ x: START_X, y: START_Y });
  const scaleAnim = useRef(new Animated.Value(1)).current;
  posRef.current = position;

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

  const handleCall911 = () => {
    playBounce();
    Alert.alert(
      'Call Emergency',
      'Do you want to call 911 for emergency assistance?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call 911',
          style: 'destructive',
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            Linking.openURL('tel:911').catch(() => {
              Alert.alert('Error', 'Unable to open phone dialer.');
            });
          },
        },
      ]
    );
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
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          handleCall911();
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
      <Text style={styles.sosText}>SOS</Text>
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
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.md,
  },
  sosText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.white,
    letterSpacing: 1,
  },
});
