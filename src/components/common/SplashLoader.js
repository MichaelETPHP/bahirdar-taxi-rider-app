import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../constants/colors';

const { width } = Dimensions.get('window');

/**
 * A lightweight version of the SplashScreen used as a loader
 * within the app to maintain a consistent brand experience.
 */
export default function SplashLoader({ text = 'Detecting Location...' }) {
  const barWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Loop the progress bar animation for a continuous loading feel
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(barWidth, {
          toValue: width * 0.6,
          duration: 2000,
          useNativeDriver: false,
        }),
        Animated.timing(barWidth, {
          toValue: 0,
          duration: 0,
          useNativeDriver: false,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [barWidth]);

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
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: barWidth }]} />
          </View>
          <Text style={styles.loadingText}>{text}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10000,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.45)', // Slight darken for readability
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 120,
  },
  content: {
    alignItems: 'center',
  },
  barTrack: {
    width: width * 0.6,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: colors.white,
    fontWeight: '700',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
