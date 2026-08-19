import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';
import AppButton from '../common/AppButton';
import { hasRealInternet } from '../../utils/networkCheck';

/**
 * Full-screen offline gate — shown by App.js the instant its own
 * connectivity poll detects no internet, at any point in the app's
 * lifetime, not just at launch. That same poll keeps running underneath
 * this screen and flips back automatically the moment a check succeeds
 * (via onConnected), so this component doesn't need its own duplicate
 * polling loop — the "Try Again" button below is just for a rider who
 * wants to check right now instead of waiting for the next automatic one.
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
