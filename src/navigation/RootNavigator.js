import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import useAuthStore from '../store/authStore';
import useRideStore from '../store/rideStore';
import useSessionManager from '../hooks/useSessionManager';
import { connectSocket, disconnectSocket, joinRiderRoom, listenForWalletUpdate, removeWalletUpdateListener } from '../services/socketService';
import { attachCallSocketListeners } from '../services/callEngine';
import { setupCallKeep } from '../services/callKeepService';
import { getActiveTrip } from '../services/tripService';

import SplashScreen from '../screens/auth/SplashScreen';
import SessionExpiredBanner from '../components/common/SessionExpiredBanner';
import UpdateBanner from '../components/common/UpdateBanner';
import CallOverlay from '../components/call/CallOverlay';
import { parseTripPollResponse } from '../utils/tripLifecycle';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loadTokens = useAuthStore((s) => s.loadTokens);
  const updateUser = useAuthStore((s) => s.updateUser);
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
      attachCallSocketListeners();

      // Global balance sync — any screen reading user.walletBalance stays
      // live the moment a top-up/withdrawal/trip fare changes it server-side,
      // no pull-to-refresh needed anywhere in the app.
      const onWalletUpdate = (data) => {
        if (typeof data?.balance === 'number') {
          updateUser({ walletBalance: data.balance });
        }
      };
      listenForWalletUpdate(onWalletUpdate);
      return () => removeWalletUpdateListener(onWalletUpdate);
    } else {
      disconnectSocket();
    }
  }, [isAuthenticated, token, user?.id, updateUser]);

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

  const handleSplashFinish = async () => {
    // Awaited, not fire-and-forget — CallKeep requests its own Android
    // permissions (CALL_PHONE etc.), and the Home screen mounting before
    // this finishes lets its own location check land at the same moment,
    // which can make Android's permission system hang one of the two calls
    // indefinitely (the "stuck on Detecting Location forever" bug). Waiting
    // here means nothing else can ever start mid-request again, regardless
    // of what future screens do on mount.
    try {
      await setupCallKeep();
    } catch (err) {
      console.warn('[RootNavigator] CallKeep setup failed:', err);
    }
    setSplashFinished(true);
  };

  // ── Scenario 1: tokens loading, splash animation running, or trip-restore
  // check still in flight ── One continuous splash instead of two separate
  // screens. The trip-restore check (see the effect above) already starts
  // in parallel with the splash's own network/permission checks — this just
  // keeps the same brand splash up until every check is truly done, instead
  // of swapping to a second, differently-captioned screen for whatever's
  // left. Nothing here waits any longer than before; it just stops
  // rendering a visible hand-off between two screens for it.
  if (!bootstrapped || !splashFinished || (isAuthenticated && !tripRestoreChecked)) {
    return (
      <>
        <SplashScreen onFinish={handleSplashFinish} />
        <SessionExpiredBanner />
        {/* A ringing call outranks the splash sequence — this is the whole
            fix for "tap the call notification and sit through Preparing
            your ride... before the ring screen finally shows." The socket
            connects and call:invite listeners attach the moment
            isAuthenticated flips true (the effect above), well before
            splashFinished/tripRestoreChecked resolve, so the call can
            already be known here. CallOverlay renders nothing when idle,
            so this is a no-op on every normal (non-call) launch. */}
        {isAuthenticated && <CallOverlay />}
      </>
    );
  }

  // ── Scenario 2: Bootstrapped and animation done → Show App ──
  return (
    <NavigationContainer ref={navigationRef}>
      <SessionExpiredBanner />
      <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="AppNav">
            {() => <AppNavigator initialRouteName={initialRouteName} />}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="AuthNav" component={AuthNavigator} />
        )}
      </Stack.Navigator>
      {isAuthenticated && <CallOverlay />}
      <UpdateBanner />
    </NavigationContainer>
  );
}
