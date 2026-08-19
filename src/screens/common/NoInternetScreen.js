import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';
import AppButton from '../common/AppButton';
import { hasRealInternet } from '../../utils/networkCheck';

const SILENT_RECHECK_MS = 5000;

/**
 * Cold-start-offline gate — distinct from NetworkBanner, which handles
 * connectivity dropping mid-session (a lightweight strip, since there's
 * already real content underneath worth not hiding). This is for when
 * there's nothing to show yet at all, so it gets the full, friendlier
 * screen instead of a thin bar.
 *
 * Recovers on its own: polls silently in the background and calls
 * onConnected() the instant real internet comes back, so a rider whose
 * connection returns mid-read never has to remember to tap anything.
 */
export default function NoInternetScreen({ onConnected }) {
  const [retrying, setRetrying] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, scale]);

  useEffect(() => {
    let cancelled = false;
    const interval = setInterval(async () => {
      const online = await hasRealInternet();
      if (!cancelled && online) onConnected?.();
    }, SILENT_RECHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [onConnected]);

  const handleRetry = async () => {
    setRetrying(true);
    const online = await hasRealInternet();
    setRetrying(false);
    if (online) onConnected?.();
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <SafeAreaView style={styles.content}>
        <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
          <View style={styles.iconBadge}>
            <WifiOff size={36} color={colors.primary} strokeWidth={2} />
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
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
  },
  iconBadge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(47,112,199,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  retryBtn: {
    width: '100%',
  },
});
