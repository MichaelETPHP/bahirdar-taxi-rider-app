import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';
import AppButton from '../../components/common/AppButton';
import { hasRealInternet } from '../../utils/networkCheck';

/**
 * Offline overlay — shown by App.js the instant its connectivity poll
 * detects no internet, at any point in the app's lifetime. Deliberately a
 * dimmed overlay on top of whatever screen the rider is already on, not a
 * full screen swap — their current screen stays mounted and dimly visible
 * underneath, so reconnecting drops them back exactly where they were
 * instead of an app-wide re-mount.
 *
 * That same connectivity poll keeps running underneath this and flips it
 * away automatically the moment a check succeeds (via onConnected), so this
 * component doesn't need its own duplicate polling loop — "Try Again" below
 * is just for a rider who wants to check right now instead of waiting for
 * the next automatic one.
 */
export default function NoInternetScreen({ onConnected }) {
  const [retrying, setRetrying] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardScale, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, cardOpacity, cardScale]);

  const handleRetry = async () => {
    setRetrying(true);
    const online = await hasRealInternet();
    setRetrying(false);
    if (online) onConnected?.();
  };

  return (
    <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
      <View style={styles.content}>
        <Animated.View style={[styles.card, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <View style={styles.iconBadge}>
            <WifiOff size={32} color={colors.primary} strokeWidth={2} />
          </View>
          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.message}>
            Please check your Wi-Fi or mobile data, then try again.
          </Text>
          <AppButton
            title="Try Again"
            onPress={handleRetry}
            loading={retrying}
            style={styles.retryBtn}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,27,30,0.55)',
    zIndex: 9998,
    elevation: 9998,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  iconBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(47,112,199,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryBtn: {
    width: '100%',
  },
});
