import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

const { width } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.96)).current;
  const progress = useRef(new Animated.Value(0)).current;
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    const intro = Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, tension: 70, friction: 9, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: 900, useNativeDriver: false }),
    ]);

    intro.start(({ finished }) => {
      if (finished) onFinishRef.current?.();
    });

    return () => intro.stop();
  }, [opacity, progress, scale]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/splash.png')}
        style={styles.backgroundImage}
        contentFit="cover"
        priority="high"
        cachePolicy="disk"
      />
      <View style={styles.content}>
        <View style={styles.spacer} />
        <Animated.View style={[styles.footer, { opacity, transform: [{ scale }] }]}>
          <View style={styles.barTrack}>
            <Animated.View
              style={[
                styles.barFill,
                { width: progress.interpolate({ inputRange: [0, 1], outputRange: [0, width * 0.6] }) },
              ]}
            />
          </View>
          <Text style={styles.loadingText}>Preparing your ride...</Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.primary },
  backgroundImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  content: { flex: 1, justifyContent: 'space-between', paddingVertical: 80 },
  spacer: { flex: 1 },
  footer: { alignItems: 'center', paddingBottom: 20 },
  barTrack: {
    width: width * 0.6,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: { height: 4, backgroundColor: colors.white, borderRadius: 2 },
  loadingText: { marginTop: 12, fontSize: fontSize.sm, color: colors.white, fontWeight: fontWeight.medium },
});
