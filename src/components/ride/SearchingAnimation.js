import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

export default function SearchingAnimation() {
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring3 = useRef(new Animated.Value(0)).current;

  const createRingAnimation = (anim, delay) =>
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(anim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

  useEffect(() => {
    const a1 = createRingAnimation(ring1, 0);
    const a2 = createRingAnimation(ring2, 500);
    const a3 = createRingAnimation(ring3, 1000);
    a1.start();
    a2.start();
    a3.start();
    return () => {
      a1.stop();
      a2.stop();
      a3.stop();
    };
  }, []);

  const ringStyle = (anim) => ({
    transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.5] }) }],
    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.ring, styles.ring3, ringStyle(ring3)]} />
      <Animated.View style={[styles.ring, styles.ring2, ringStyle(ring2)]} />
      <Animated.View style={[styles.ring, styles.ring1, ringStyle(ring1)]} />
      <View style={styles.center}>
        <FontAwesome5 name="car" size={22} color={colors.white} solid />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 140,
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  ring1: {
    width: 60,
    height: 60,
    opacity: 0.6,
  },
  ring2: {
    width: 80,
    height: 80,
    opacity: 0.4,
  },
  ring3: {
    width: 100,
    height: 100,
    opacity: 0.2,
  },
  center: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
