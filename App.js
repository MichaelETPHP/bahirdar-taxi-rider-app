import 'react-native-gesture-handler';
import './src/i18n';

import React, { useEffect } from 'react';
import { Platform, Text, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as PaperProvider } from 'react-native-paper';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/RootNavigator';
import { fontFamilyItalic } from './src/constants/typography';

enableScreens();

const queryClient = new QueryClient();

function applyGlobalFont() {
  // Use a flat object instead of an array — avoids style-array merging on every
  // Text/TextInput render across the entire app.
  const baseTextStyle = { fontFamily: fontFamilyItalic, fontWeight: '300', fontStyle: 'italic' };
  Text.defaultProps = Text.defaultProps || {};
  TextInput.defaultProps = TextInput.defaultProps || {};
  Text.defaultProps.style = baseTextStyle;
  TextInput.defaultProps.style = baseTextStyle;
}

applyGlobalFont();

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
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Bahirdar',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00674F',
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

        if (!allowed) return;

        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Bahirdar Ride',
            body: 'Your driver is nearby. Open the app for live updates.',
            data: { route: 'Notification' },
            ...(Platform.OS === 'android' && {
              android: { channelId: 'default' },
            }),
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
        });
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

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <SafeAreaProvider>
            <StatusBar style="light" backgroundColor="#00674F" />
            <RootNavigator />
          </SafeAreaProvider>
        </PaperProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
