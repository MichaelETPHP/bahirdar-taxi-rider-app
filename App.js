import 'react-native-gesture-handler';
import './src/i18n';

import React, { useEffect, useState } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { Asset } from 'expo-asset';
import { Image as ExpoImage } from 'expo-image';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';
import { StripeProvider } from '@stripe/stripe-react-native';
import RootNavigator from './src/navigation/RootNavigator';
import SplashLoader from './src/components/common/SplashLoader';
import { navigationRef } from './src/navigation/RootNavigator';
import { fontFamily } from './src/constants/typography';
import MaintenanceScreen from './src/screens/common/MaintenanceScreen';
import { checkMaintenanceStatus } from './src/api/maintenance';
import useMaintenanceStore from './src/store/maintenanceStore';
import UpdateRequiredScreen from './src/screens/common/UpdateRequiredScreen';
import { checkAppVersion } from './src/api/appVersion';
import useUpdateStore from './src/store/updateStore';
import NoInternetScreen from './src/screens/common/NoInternetScreen';
import { hasRealInternet } from './src/utils/networkCheck';
import NetInfo from '@react-native-community/netinfo';
import { registerBackgroundCallTask } from './src/services/backgroundCallTask';
import { migrateSecureStorage } from './src/lib/migrateSecureStorage';
import useAuthStore from './src/store/authStore';
import useRideStore from './src/store/rideStore';
import { normalizeAvatarUrl } from './src/utils/avatarUrl';
import {
  startIntegrityMonitoring,
  checkDeviceIntegrity,
  getCachedIntegrity,
  onIntegrityChange,
  reportIntegrityEvent,
} from './src/security/deviceIntegrity';
import { ensureIntegrityVerdict } from './src/security/playIntegrityClient';
import { policyForRisk } from './src/security/integrityPolicy';
import RootBlockScreen from './src/components/security/RootBlockScreen';
import { initSslPinning } from './src/security/sslPinning';
import { configureGoogleSignIn } from './src/lib/googleAuth';
import { registerDevice } from './src/services/authService';
import useCallStore from './src/store/callStore';
import { acceptIncomingCall, declineIncomingCall } from './src/services/callEngine';

// Keeps the native splash screen up past Android's own auto-dismiss timing
// (which used to race ahead of the JS bundle finishing) until App() below
// explicitly hides it — closing the white-flash gap between the native
// splash and this app's own JS SplashLoader, since the two now show the
// exact same image with no un-rendered frame in between.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Move any plaintext-stored session data into SecureStore before anything
// reads auth state (idempotent; reads after this also migrate lazily).
migrateSecureStorage();

// INSA: pin the API's certificate keys before any network request leaves the
// app — a MITM proxy can never impersonate the backend after this resolves.
initSslPinning();

// No-op until EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is set — see .env.development.
configureGoogleSignIn();

enableScreens();

const queryClient = new QueryClient();

async function loadCustomFonts() {
  // Fonts are loaded from locally-bundled files — no network required.
  // CDN URLs were removed because they fail in Expo Go and on slow/no network.
  try {
    await Font.loadAsync({
      'PlusJakartaSans-Light':    require('./assets/fonts/PlusJakartaSans-Light.ttf'),
      'PlusJakartaSans-Regular':  require('./assets/fonts/PlusJakartaSans-Regular.ttf'),
      'PlusJakartaSans-Medium':   require('./assets/fonts/PlusJakartaSans-Medium.ttf'),
      'PlusJakartaSans-SemiBold': require('./assets/fonts/PlusJakartaSans-SemiBold.ttf'),
      'PlusJakartaSans-Bold':     require('./assets/fonts/PlusJakartaSans-Bold.ttf'),
      'PlusJakartaSans-Italic':   require('./assets/fonts/PlusJakartaSans-Italic.ttf'),
    });
  } catch {
    // Font files not yet downloaded — app continues with system font, no warning needed
  }
}

// Login (PhoneEntryScreen) and ProfileSetupScreen both render this as a
// full-screen background the instant they mount — without a head start it's
// decoded from scratch right as the screen appears, which can show as a
// blank/flashed frame first. Priming it into the asset cache here, in
// parallel with everything else App.js already does at startup, means it's
// ready before either screen is ever reached.
async function preloadBackgroundPattern() {
  try {
    await Asset.loadAsync(require('./assets/bg-pattern.png'));
  } catch {
    // Non-fatal — the screen still renders the image normally, just without
    // the head start.
  }
}

// Ride category icons are remote and were previously only ever requested
// once RideTypeSelector mounted — i.e. after the rider had already picked a
// destination. Categories need no auth, so the fetch (and the icon
// downloads it enables) can start the moment the app opens instead of
// waiting for the rider to get that far, so by the time the category sheet
// actually opens, expo-image serves every icon from its own disk cache
// instead of the network.
async function preloadCategoryIcons() {
  try {
    await useRideStore.getState().loadCategories();
    const categories = useRideStore.getState().categories;
    // image_url ("Rider Type Image URL") is what RideTypeCard.js actually
    // displays; car_icon_url ("Map Car Icon") is only its fallback. Must
    // match RideTypeCard.js's own precedence exactly (including the
    // normalizeAvatarUrl call there), or this prefetches the wrong — or a
    // bare relative-path — URL that expo-image can't actually cache.
    const urls = categories
      .map((c) => normalizeAvatarUrl(c.image_url || c.imageUrl || c.imageURL || c.car_icon_url || c.carIconUrl))
      .filter(Boolean);
    await Promise.all(urls.map((url) => ExpoImage.prefetch(url).catch(() => {})));
  } catch {
    // Non-fatal — RideTypeSelector's own loadCategories() call still covers
    // this, just without the head start.
  }
}

function applyGlobalFont() {
  // Use Plus Jakarta Sans as the default font
  const baseTextStyle = { fontFamily: fontFamily, fontWeight: '400' };
  Text.defaultProps = Text.defaultProps || {};
  TextInput.defaultProps = TextInput.defaultProps || {};
  Text.defaultProps.style = baseTextStyle;
  TextInput.defaultProps.style = baseTextStyle;
}

// Incoming in-app voice calls (the type set below) suppress their own
// banner/sound if the live call UI is already ringing on screen — the
// socket event usually beats the push here, no need for both to alert.
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const type = notification.request.content.data?.type;
    const isCallInvite = type === 'incoming_call';
    const alreadyRinging = isCallInvite && useCallStore.getState().status === 'incoming';
    return {
      shouldPlaySound: !alreadyRinging,
      shouldSetBadge: true,
      shouldShowBanner: !alreadyRinging,
      shouldShowList: !alreadyRinging,
    };
  },
});

const CALL_INVITE_CHANNEL_ID = 'call-invites-v1';
const CALL_INVITE_CATEGORY_ID = 'call_invite_actions';
const CALL_ACCEPT_ACTION_ID = 'accept_call_invite';
const CALL_DECLINE_ACTION_ID = 'decline_call_invite';

function isNotificationPermissionGranted(status) {
  if (status.granted) return true;
  if (Platform.OS === 'ios') {
    const s = status.ios?.status;
    return (
      s === Notifications.IosAuthorizationStatus.AUTHORIZED ||
      s === Notifications.IosAuthorizationStatus.PROVISIONAL
    );
  }
  return false;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== 'android') return;
  // 'default' is a reserved Android system channel whose importance cannot be overridden.
  // Use a named channel so importance and sound settings actually take effect.
  await Notifications.setNotificationChannelAsync('trip-updates', {
    name: 'Trip Updates',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2F70C7',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
  // Android silently fails to render a push's title/body if it references a
  // channelId that was never registered on-device — this MUST match the
  // channelId used server-side in expo.push.service.ts's admin broadcast
  // (currently 'admin-broadcast-v1'), or the notification arrives blank.
  await Notifications.setNotificationChannelAsync('admin-broadcast-v1', {
    name: 'Announcements',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#2F70C7',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

async function ensureCallInviteChannel() {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CALL_INVITE_CHANNEL_ID, {
    name: 'Incoming Calls',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#22C55E',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    bypassDnd: true,
    sound: 'default',
  });
}

async function registerCallInviteCategory() {
  if (Platform.OS === 'web') return;
  await Notifications.setNotificationCategoryAsync(
    CALL_INVITE_CATEGORY_ID,
    [
      {
        identifier: CALL_DECLINE_ACTION_ID,
        buttonTitle: 'Decline',
        options: { isDestructive: true, opensAppToForeground: true },
      },
      {
        identifier: CALL_ACCEPT_ACTION_ID,
        buttonTitle: 'Accept',
        options: { opensAppToForeground: true },
      },
    ],
    { previewPlaceholder: 'Incoming call', showTitle: true, showSubtitle: true },
  );
}

async function ensureNotificationPermissions() {
  await ensureAndroidNotificationChannel();
  await ensureCallInviteChannel();
  await registerCallInviteCategory().catch(() => {});
  await registerBackgroundCallTask();

  let current = await Notifications.getPermissionsAsync();
  if (!isNotificationPermissionGranted(current)) {
    current = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return isNotificationPermissionGranted(current);
}

const PUSH_DEVICE_ID =
  Constants.installationId ?? Constants.deviceId ?? `push-device-${Platform.OS}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Server push. Android now registers a real native FCM device token
 * (needs google-services.json in the build — already wired via
 * app.config.js's googleServicesFile) so the backend can send through
 * Firebase directly instead of relaying through Expo's push service. iOS
 * keeps the Expo token path (needs `extra.eas.projectId`) since it isn't
 * part of this migration — Expo's relay still owns iOS APNs delivery.
 * Saves the token to the backend so it can actually reach this device —
 * previously this only logged the token locally and never persisted it, so
 * the backend had no way to push anything to a rider at all.
 *
 * Retries the SAVE step a few times with a short backoff — this used to be
 * a single best-effort attempt with a comment saying "retried on next app
 * start," but that only helps if the rider actually restarts the app. A
 * transient failure right after login (the exact moment this fires) could
 * otherwise leave a rider permanently unreachable by push/admin-call until
 * their next cold start, which for an already-open session might be days. */
async function registerPushTokenIfConfigured() {
  try {
    let token = null;
    if (Platform.OS === 'android') {
      const devicePushToken = await Notifications.getDevicePushTokenAsync();
      token = devicePushToken?.data ?? null;
      if (__DEV__ && token) console.log('[notifications] Native FCM device token:', token);
    } else {
      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
      if (!projectId) return;
      const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
      token = data ?? null;
      if (__DEV__ && token) console.log('[notifications] Expo push token:', token);
    }
    if (!token) return;

    const RETRY_DELAYS_MS = [0, 3000, 8000];
    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt]);
      try {
        await registerDevice(token, PUSH_DEVICE_ID, Platform.OS);
        return; // saved — done
      } catch (err) {
        if (__DEV__) console.warn(`[notifications] Save push token attempt ${attempt + 1} failed:`, err?.message ?? err);
      }
    }
    // All attempts failed — falls back to the next app-start/login retry,
    // same safety net as before.
  } catch {
    // Expo Go limitations, missing google-services.json, etc.
  }
}

export default function App() {
  const { isMaintenanceMode, maintenanceData, setMaintenance } = useMaintenanceStore();
  const { updateRequired, updateInfo, setUpdateRequired } = useUpdateStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  // Offline gate — the full-screen card, and it needs to react the instant
  // connectivity actually drops, since the whole point is catching it
  // before the rider takes another action on a dead connection. Polling
  // (even fast polling) always has a built-in delay — the OS telling us
  // directly, via NetInfo, is the only way to get this close to instant:
  // it fires on the underlying network state change itself, not on our own
  // next scheduled check.
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let verifyTimer = null;

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (cancelled) return;
      // isInternetReachable is the OS's own reachability probe, once it's
      // resolved (null briefly right after a state change while still
      // checking) — trust it over isConnected, since a phone can be
      // "connected" to Wi-Fi with no real internet behind it at all.
      if (state.isConnected === false || state.isInternetReachable === false) {
        clearTimeout(verifyTimer);
        setIsOffline(true);
        return;
      }
      if (state.isInternetReachable === true) {
        clearTimeout(verifyTimer);
        setIsOffline(false);
        return;
      }
      // Still resolving — do one quick real-internet check rather than
      // optimistically clearing the gate before it's actually confirmed.
      clearTimeout(verifyTimer);
      verifyTimer = setTimeout(async () => {
        const online = await hasRealInternet();
        if (!cancelled) setIsOffline(!online);
      }, 300);
    });

    return () => {
      cancelled = true;
      clearTimeout(verifyTimer);
      unsubscribe();
    };
  }, []);

  const runMaintenanceCheck = async () => {
    try {
      const status = await checkMaintenanceStatus();
      if (status.maintenance) {
        setMaintenance(true, status);
      } else {
        setMaintenance(false);
      }
    } catch {
      setMaintenance(false);
    }
  };

  useEffect(() => {
    runMaintenanceCheck();
  }, []);

  // Force-update gate — off by default (minVersionCode/minBuildNumber: 0
  // from checkAppVersion's own fail-open default), only ever kicks in when
  // an admin has explicitly set a floor for this app+platform higher than
  // what's actually installed. Not tied to "a newer version merely exists."
  useEffect(() => {
    (async () => {
      try {
        const info = await checkAppVersion();
        // Guarded require — same pattern VersionFooter already uses, so a
        // dev client built before expo-application was added never crashes.
        let installedBuild = 0;
        try {
          const Application = require('expo-application');
          installedBuild = parseInt(Application.nativeBuildVersion, 10) || 0;
        } catch { /* module not in this binary yet */ }

        const floor = Platform.OS === 'ios' ? info.minBuildNumber : info.minVersionCode;
        if (floor && installedBuild && installedBuild < floor) {
          setUpdateRequired(true, info);
        } else {
          setUpdateRequired(false);
        }
      } catch {
        setUpdateRequired(false);
      }
    })();
  }, []);

  // Hides the native splash the instant this component has actually
  // mounted and painted its first frame — which is always either
  // SplashLoader (same splash.png, so the handoff is invisible) or real
  // content, never a blank Activity background.
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  // Native call UI (CallKit / ConnectionService) setup moved to
  // RootNavigator's handleSplashFinish — it requests its own Android
  // permissions (CALL_PHONE etc.), and firing that at the same time as the
  // splash screen's own location/microphone requests let two native
  // permission dialogs race, which could leave one of them hung waiting on
  // a popup Android never showed. Sequencing it after splash finishes
  // avoids that.

  // INSA: device integrity — a high-risk device (rooted / hooking tools /
  // emulator) never reaches the navigator: the whole app is replaced by
  // RootBlockScreen and login is unreachable. Detection runs at startup and
  // on every app resume.
  //
  // integrityReady stays false until the FIRST verdict is known — we hold the
  // splash/loading screen during that window so login/OTP can never render
  // before the async jail-monkey/expo-device checks resolve.
  const [integrityReady, setIntegrityReady] = useState(false);
  const [integrityBlocked, setIntegrityBlocked] = useState(() => {
    const cached = getCachedIntegrity();
    return cached ? policyForRisk(cached.riskLevel).appAccess === 'blocked' : false;
  });
  useEffect(() => {
    startIntegrityMonitoring();
    const sync = (r) => {
      setIntegrityBlocked(policyForRisk(r.riskLevel).appAccess === 'blocked');
      setIntegrityReady(true);
    };
    const cached = getCachedIntegrity();
    if (cached) {
      sync(cached);
    } else {
      checkDeviceIntegrity().then(sync);
    }
    return onIntegrityChange(sync);
  }, []);
  useEffect(() => {
    if (!isAuthenticated) return;
    const cached = getCachedIntegrity();
    if (cached) reportIntegrityEvent(cached);
    ensureIntegrityVerdict();
    return onIntegrityChange(reportIntegrityEvent);
  }, [isAuthenticated]);
  // Any lingering authenticated session on a blocked device is terminated
  // within one minute of detection.
  useEffect(() => {
    if (!integrityBlocked || !isAuthenticated) return;
    const timer = setTimeout(() => {
      useAuthStore.getState().logout();
    }, 60 * 1000);
    return () => clearTimeout(timer);
  }, [integrityBlocked, isAuthenticated]);

  useEffect(() => {
    loadCustomFonts();
    applyGlobalFont();
    preloadBackgroundPattern();
    preloadCategoryIcons();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Location.requestForegroundPermissionsAsync();
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  useEffect(() => {
    let cancelled = false;
    let subscription;

    (async () => {
      try {
        const allowed = await ensureNotificationPermissions();
        if (cancelled) return;

        subscription = Notifications.addNotificationResponseReceivedListener((response) => {
          const data = response?.notification?.request?.content?.data;

          // Incoming call — Accept/Decline only actually connect anything
          // if this app's JS process (and its in-memory RTCPeerConnection)
          // is still alive; a fully killed-and-relaunched process has
          // nothing to resume, so this is best-effort, not a guarantee. A
          // plain tap just opens the app — the call overlay renders itself
          // from whatever the live socket state already is.
          if (data?.type === 'incoming_call') {
            if (response.actionIdentifier === CALL_ACCEPT_ACTION_ID) {
              acceptIncomingCall();
            } else if (response.actionIdentifier === CALL_DECLINE_ACTION_ID) {
              declineIncomingCall();
            }
            return;
          }

          if (data?.route === 'Notification' && navigationRef.isReady()) {
            navigationRef.navigate('AppNav', { screen: 'Notification' });
          }
        });

        if (allowed) {
          await registerPushTokenIfConfigured();
        }
      } catch (e) {
        if (__DEV__) {
          console.warn('[notifications]', e?.message ?? e);
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  // The permission-request effect above runs once at mount, before the user
  // may have logged in yet — saving the push token then would 401 (the
  // endpoint requires auth) and never retry. Re-attempt whenever auth state
  // flips to true, mirroring the driver app's syncPushToken pattern.
  // registerPushTokenIfConfigured() is idempotent, so this is safe to
  // run again even if the mount-time attempt already succeeded.
  useEffect(() => {
    if (!isAuthenticated) return;
    registerPushTokenIfConfigured().catch(() => {});
  }, [isAuthenticated]);

  // INSA: hold a lightweight loading screen until the FIRST device-integrity
  // verdict is known — must resolve before the navigator so a rooted device
  // can never render login/OTP even for one frame.
  if (!integrityReady) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SplashLoader text="Securing your session..." />
      </GestureHandlerRootView>
    );
  }

  // INSA: compromised device — outranks every other screen, login unreachable
  if (integrityBlocked) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootBlockScreen />
      </GestureHandlerRootView>
    );
  }

  if (isMaintenanceMode && maintenanceData) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <MaintenanceScreen
          title={maintenanceData.title}
          message={maintenanceData.message}
          estimatedTime={maintenanceData.estimatedTime}
          contact={maintenanceData.contact}
          onRetry={runMaintenanceCheck}
        />
      </GestureHandlerRootView>
    );
  }

  if (updateRequired) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <UpdateRequiredScreen updateUrl={updateInfo?.updateUrl} />
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StripeProvider
        publishableKey={process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.com.bahirdar.ride"
      >
        <QueryClientProvider client={queryClient}>
          <PaperProvider>
            <SafeAreaProvider>
              <StatusBar style="light" backgroundColor="#2F70C7" />
              <RootNavigator />
            </SafeAreaProvider>
          </PaperProvider>
        </QueryClientProvider>
      </StripeProvider>
      {/* Overlay, not a screen swap — the rider's current screen stays
          mounted and dimly visible underneath, so reconnecting drops them
          back exactly where they were instead of a jarring re-mount. */}
      {isOffline && <NoInternetScreen onConnected={() => setIsOffline(false)} />}
    </GestureHandlerRootView>
  );
}
