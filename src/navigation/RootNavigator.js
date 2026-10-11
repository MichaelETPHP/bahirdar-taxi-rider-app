import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import * as Updates from 'expo-updates';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import useAuthStore from '../store/authStore';
import useRideStore from '../store/rideStore';
import useCallStore from '../store/callStore';
import useSessionManager from '../hooks/useSessionManager';
import { connectSocket, disconnectSocket, joinRiderRoom, listenForWalletUpdate, removeWalletUpdateListener } from '../services/socketService';
import { attachCallSocketListeners } from '../services/callEngine';
import { setupCallKeep } from '../services/callKeepService';
import { getActiveTrip } from '../services/tripService';

import SplashScreen from '../screens/auth/SplashScreen';
import SessionExpiredBanner from '../components/common/SessionExpiredBanner';
import UpdateBanner from '../components/common/UpdateBanner';
import OtaAppliedToast from '../components/common/OtaAppliedToast';
import UpdatingScreen from '../screens/common/UpdatingScreen';
import CallOverlay from '../components/call/CallOverlay';
import { parseTripPollResponse } from '../utils/tripLifecycle';

const Stack = createStackNavigator();
const ACTIVE_TRIP_STATUSES = ['searching', 'matched', 'driver_arrived', 'in_progress'];
export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const needsProfileSetup = useAuthStore((s) => s.needsProfileSetup);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const loadTokens = useAuthStore((s) => s.loadTokens);
  const updateUser = useAuthStore((s) => s.updateUser);
  const hydrateActiveTrip = useRideStore((s) => s.hydrateActiveTrip);
  const resetTrip = useRideStore((s) => s.resetTrip);
  const tripStatus = useRideStore((s) => s.tripStatus);
  const callStatus = useCallStore((s) => s.status);
  const { isUpdatePending } = Updates.useUpdates();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);
  const [tripRestoreChecked, setTripRestoreChecked] = useState(false);
  const [tripRestoreSafe, setTripRestoreSafe] = useState(false);
  const [isForeground, setIsForeground] = useState(AppState.currentState === 'active');
  const [isNetworkReady, setIsNetworkReady] = useState(true);
  const [initialRouteName, setInitialRouteName] = useState('Home');
  const tripRestoreResolved = useRef(false);
  const callKeepSetupStarted = useRef(false);
  const restoreIdentity = isAuthenticated ? `${user?.id ?? ''}:${token ?? ''}` : 'anonymous';

  // Initialize 30-day session management with app lifecycle tracking
  useSessionManager();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => setIsForeground(state === 'active'));
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      setIsNetworkReady(state.isConnected !== false && state.isInternetReachable !== false);
    });
    return () => { subscription.remove(); unsubscribeNetwork(); };
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await loadTokens();
      } catch (err) {
        console.error('[Auth] Failed to load tokens:', err);
      } finally {
        setBootstrapped(true);
      }
    };

    bootstrap();
  }, [loadTokens]);

  useEffect(() => {
    tripRestoreResolved.current = false;
  }, [restoreIdentity]);

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
      if (!isForeground || tripRestoreResolved.current) return;
      if (!bootstrapped) return;

      if (!isNetworkReady) {
        setTripRestoreSafe(false);
        setTripRestoreChecked(true);
        return;
      }
      if (!isAuthenticated || !token || !user?.id) {
        resetTrip();
        setInitialRouteName('Home');
        setTripRestoreSafe(true);
        setTripRestoreChecked(true);
        tripRestoreResolved.current = true;
        return;
      }

      setTripRestoreChecked(false);
      setTripRestoreSafe(false);

      const rideAtRequest = useRideStore.getState();
      try {
        const res = await getActiveTrip(token, { timeout: 6500 });
        if (cancelled) return;
        const rideNow = useRideStore.getState();
        if (rideNow.tripId !== rideAtRequest.tripId || rideNow.tripStatus !== rideAtRequest.tripStatus) return;

        const root = res?.data ?? res;
        const tripCandidate = root?.trip ?? ((root?.id || root?.trip_id) ? root : null);
        const { status, trip, driver } = parseTripPollResponse(root);
        const activeTrip = trip && (trip.id || trip.trip_id)
          ? { ...trip, id: trip.id ?? trip.trip_id }
          : null;
        const hasValidActiveTrip = !!(tripCandidate?.id || tripCandidate?.trip_id) &&
          !!activeTrip?.id && ACTIVE_TRIP_STATUSES.includes(status);

        if (!hasValidActiveTrip) {
          const confirmedInactive = !!root && typeof root === 'object' && !ACTIVE_TRIP_STATUSES.includes(status);
          resetTrip();
          setInitialRouteName('Home');
          setTripRestoreSafe(confirmedInactive);
          setTripRestoreChecked(true);
          tripRestoreResolved.current = confirmedInactive;
          return;
        }

        hydrateActiveTrip({ trip: activeTrip, status, driver });
        setTripRestoreSafe(true);
        setInitialRouteName('ActiveTripResume');
        tripRestoreResolved.current = true;
        if (navigationRef.isReady()) {
          navigationRef.navigate('AppNav', { screen: 'ActiveTripResume' });
        }
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
  }, [bootstrapped, isAuthenticated, token, user?.id, hydrateActiveTrip, resetTrip, isForeground, isNetworkReady]);

  const safeTripStates = ['idle', 'completed', 'cancelled'];
  const forceUpdateNow = isForeground && bootstrapped && splashFinished && tripRestoreChecked &&
    tripRestoreSafe && isUpdatePending && safeTripStates.includes(tripStatus) && callStatus === 'idle';

  const handleSplashFinish = useCallback(() => {
    setSplashFinished(true);
  }, []);

  useEffect(() => {
    if (!bootstrapped || !isAuthenticated || !splashFinished || callKeepSetupStarted.current) return undefined;
    // Call integration is optional for app startup and asks for unrelated
    // phone permissions on Android. Defer it until the home screen has had
    // time to finish its location prompt; never hold navigation on it.
    const timer = setTimeout(() => {
      callKeepSetupStarted.current = true;
      setupCallKeep().catch((err) => console.warn('[RootNavigator] CallKeep setup failed:', err));
    }, 5000);
    return () => clearTimeout(timer);
  }, [bootstrapped, isAuthenticated, splashFinished]);

  // Auth state can hydrate from secure storage before a slow token refresh
  // completes; render the app shell as soon as that saved identity is known.
  if ((!bootstrapped && !isAuthenticated && !needsProfileSetup) || !splashFinished) {
    return (
      <>
        <SplashScreen onFinish={handleSplashFinish} />
        <SessionExpiredBanner />
        {/* Keep a ringing call visible while auth and the intro finish. */}
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
          <Stack.Screen name="AuthNav">
            {() => (
              <AuthNavigator
                initialRouteName={needsProfileSetup ? 'ProfileSetup' : 'PhoneEntry'}
              />
            )}
          </Stack.Screen>
        )}
      </Stack.Navigator>
      {isAuthenticated && <CallOverlay />}
      <UpdateBanner tripRestoreSafe={tripRestoreSafe} />
      <OtaAppliedToast />
      {forceUpdateNow && <UpdatingScreen />}
    </NavigationContainer>
  );
}
