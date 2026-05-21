import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { Image } from 'expo-image';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import useAuthStore from '../store/authStore';
import useRideStore from '../store/rideStore';
import useSessionManager from '../hooks/useSessionManager';
import { connectSocket, disconnectSocket, joinRiderRoom } from '../services/socketService';
import { getActiveTrip } from '../services/tripService';

import SplashScreen from '../screens/auth/SplashScreen';
import NetworkBanner from '../components/common/NetworkBanner';
import { parseTripPollResponse } from '../utils/tripLifecycle';
import { colors } from '../constants/colors';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loadTokens = useAuthStore((s) => s.loadTokens);
  const hydrateActiveTrip = useRideStore((s) => s.hydrateActiveTrip);
  const resetTrip = useRideStore((s) => s.resetTrip);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [tripRestoreChecked, setTripRestoreChecked] = useState(false);
  const [initialRouteName, setInitialRouteName] = useState('Home');

  // Initialize 30-day session management with app lifecycle tracking
  useSessionManager();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Load existing session (30-day persistent login)
        await loadTokens();
      } catch (err) {
        console.error('[Auth] Failed to load tokens:', err);
      } finally {
        setBootstrapped(true);
      }
    };

    bootstrap();
  }, [loadTokens]);

  // Keep the socket open whenever the rider is authenticated.
  // This ensures auth:force_logout is received even when the user is idle
  // on the home screen or any other screen — not just during an active trip.
  useEffect(() => {
    if (isAuthenticated && token && user?.id) {
      connectSocket(token);
      joinRiderRoom(user.id);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, token, user?.id]);

  useEffect(() => {
    let cancelled = false;

    const restoreActiveTrip = async () => {
      if (!isAuthenticated || !token || !user?.id) {
        resetTrip();
        setInitialRouteName('Home');
        setTripRestoreChecked(true);
        return;
      }

      setTripRestoreChecked(false);

      try {
        const res = await getActiveTrip(token);
        if (cancelled) return;

        const root = res?.data ?? res;
        const hasActiveTrip = !!(root?.trip || root?.id || root?.status);
        if (!hasActiveTrip) {
          resetTrip();
          setInitialRouteName('Home');
          setTripRestoreChecked(true);
          return;
        }

        const { status, trip, driver } = parseTripPollResponse(root);
        if (!trip || !status) {
          resetTrip();
          setInitialRouteName('Home');
          setTripRestoreChecked(true);
          return;
        }

        hydrateActiveTrip({ trip, status, driver });
        setInitialRouteName(
          ['searching', 'matched', 'driver_arrived', 'in_progress'].includes(status)
            ? 'ActiveTripResume'
            : 'Home'
        );
      } catch (_) {
        if (!cancelled) {
          setInitialRouteName('Home');
        }
      } finally {
        if (!cancelled) {
          setTripRestoreChecked(true);
        }
      }
    };

    restoreActiveTrip();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, token, user?.id, hydrateActiveTrip, resetTrip]);

  const handleSplashFinish = () => {
    setSplashFinished(true);
  };

  // ── Scenario 1: Still loading tokens or animation in progress ──
  if (!bootstrapped || !splashFinished) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (isAuthenticated && !tripRestoreChecked) {
    return (
      <View style={styles.restoreRoot}>
        <Image
          source={require('../../assets/splash.png')}
          style={styles.restoreBg}
          contentFit="cover"
          transition={300}
          priority="high"
          cachePolicy="disk"
        />
        <View style={styles.restoreOverlay}>
          <ActivityIndicator size="large" color={colors.white} />
          <Text style={styles.restoreText}>Restoring your trip…</Text>
        </View>
      </View>
    );
  }

  // ── Scenario 2: Bootstrapped and animation done → Show App ──
  return (
    <NavigationContainer ref={navigationRef}>
      <NetworkBanner />
      <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="AppNav">
            {() => <AppNavigator initialRouteName={initialRouteName} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="AuthNav" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  restoreRoot: {
    flex: 1,
  },
  restoreBg: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  restoreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  restoreText: {
    marginTop: 14,
    fontSize: 16,
    color: colors.white,
    fontWeight: '600',
  },
});
