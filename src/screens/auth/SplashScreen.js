import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Car } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

const { width } = Dimensions.get('window');

export default function SplashScreen({ navigation }) {
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: width * 0.6,
        duration: 2500,
        useNativeDriver: false,
      }),
    ]).start(() => {
      navigation.replace('PhoneEntry');
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Full-screen background image */}
      <Image
        source={require('../../../assets/splash.png')}
        style={styles.backgroundImage}
        resizeMode="cover"
      />

      <View style={styles.content}>
        <View style={styles.topHalf}>
          <Animated.View
            style={[
              styles.logoCircle,
              { transform: [{ scale: logoScale }], opacity: logoOpacity },
            ]}
          >
            <Car size={52} color="white" />
          </Animated.View>

        <Animated.View style={[styles.textBlock, { opacity: textOpacity }]}>
          <Text style={styles.appName}>Welcome to Bahiran Ride</Text>
          <Text style={styles.taglineAmharic}>ወደ መዳረሻዎ በፍጥነት</Text>
          <Text style={styles.taglineEn}>Fast rides in Addis Ababa</Text>
        </Animated.View>
        </View>

        <View style={styles.bottomHalf}>
          <View style={styles.barTrack}>
            <Animated.View style={[styles.barFill, { width: barWidth }]} />
          </View>
          <Text style={styles.loadingText}>Preparing your ride...</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  topHalf: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  textBlock: {
    alignItems: 'center',
    marginTop: 24,
  },
  appName: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.primary,
    letterSpacing: -0.5,
  },
  taglineAmharic: {
    fontSize: fontSize.lg,
    color: colors.textPrimary,
    marginTop: 8,
    fontWeight: fontWeight.medium,
  },
  taglineEn: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginTop: 4,
  },
  bottomHalf: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  barTrack: {
    width: width * 0.6,
    height: 4,
    backgroundColor: colors.primaryLight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
});
