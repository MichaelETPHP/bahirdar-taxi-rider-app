import 'react-native-gesture-handler';
import './src/i18n';

import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as Font from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';
import RootNavigator from './src/navigation/RootNavigator';
import SplashLoader from './src/components/common/SplashLoader';
import { navigationRef } from './src/navigation/RootNavigator';
import { fontFamily } from './src/constants/typography';
import MaintenanceScreen from './src/screens/common/MaintenanceScreen';
import { checkMaintenanceStatus } from './src/api/maintenance';
import useMaintenanceStore from './src/store/maintenanceStore';
import { migrateSecureStorage } from './src/lib/migrateSecureStorage';
import useAuthStore from './src/store/authStore';
import {
  startIntegrityMonitoring,
  checkDeviceIntegrity,
  getCachedIntegrity,
  onIntegrityChange,
  reportIntegrityEvent,
  __devSimulateRooted,
} from './src/security/deviceIntegrity';
import { ensureIntegrityVerdict } from './src/security/playIntegrityClient';
import { policyForRisk } from './src/security/integrityPolicy';
import RootBlockScreen from './src/components/security/RootBlockScreen';
import { initSslPinning } from './src/security/sslPinning';

// Move any plaintext-stored session data into SecureStore before anything
// reads auth state (idempotent; reads after this also migrate lazily).
migrateSecureStorage();

// INSA: pin the API's certificate keys before any network request leaves the
// app — a MITM proxy can never impersonate the backend after this resolves.
initSslPinning();

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

function applyGlobalFont() {
  // Use Plus Jakarta Sans as the default font
  const baseTextStyle = { fontFamily: fontFamily, fontWeight: '400' };
  Text.defaultProps = Text.defaultProps || {};
  TextInput.defaultProps = TextInput.defaultProps || {};
  Text.defaultProps.style = baseTextStyle;
  TextInput.defaultProps.style = baseTextStyle;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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
    lightColor: '#00674F',
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    sound: 'default',
  });
}

async function ensureNotificationPermissions() {
  await ensureAndroidNotificationChannel();

  let current = await Notifications.getPermissionsAsync();
  if (!isNotificationPermissionGranted(current)) {
    current = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  return isNotificationPermissionGranted(current);
}

/** Server push (FCM/APNs via Expo). Needs `extra.eas.projectId` in app config and a dev/standalone build on Android SDK 53+. */
async function registerExpoPushTokenIfConfigured() {
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return;
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    if (__DEV__) {
      console.log('[notifications] Expo push token (use on your backend):', data);
    }
  } catch {
    // Expo Go limitations, missing google-services.json, etc.
  }
}

export default function App() {
  const { isMaintenanceMode, maintenanceData, setMaintenance } = useMaintenanceStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

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
          if (data?.route === 'Notification' && navigationRef.isReady()) {
            navigationRef.navigate('AppNav', { screen: 'Notification' });
          }
        });

        if (allowed) {
          await registerExpoPushTokenIfConfigured();
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
        <DevIntegrityFloatingButton />
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <SafeAreaProvider>
            <StatusBar style="light" backgroundColor="#00674F" />
            <RootNavigator />
            <DevIntegrityFloatingButton />
          </SafeAreaProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

/**
 * DEV-ONLY floating test button — reachable on EVERY screen (phone entry,
 * OTP, home, anywhere), including before authentication, so the
 * rooted-device block can be verified starting from the very first screen
 * without needing physical rooted hardware. Dead code in release builds.
 */
function DevIntegrityFloatingButton() {
  if (!__DEV__) return null;
  return (
    <View pointerEvents="box-none" style={devStyles.wrap}>
      <Pressable style={[devStyles.btn, devStyles.btnDanger]} onPress={() => __devSimulateRooted(true)}>
        <Text style={devStyles.btnText}>ROOT</Text>
      </Pressable>
      <Pressable style={devStyles.btn} onPress={() => __devSimulateRooted(false)}>
        <Text style={devStyles.btnText}>CLEAN</Text>
      </Pressable>
    </View>
  );
}

const devStyles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 48,
    right: 12,
    flexDirection: 'row',
    gap: 6,
    zIndex: 9999,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#374151',
  },
  btnDanger: { backgroundColor: '#DC2626' },
  btnText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
});
