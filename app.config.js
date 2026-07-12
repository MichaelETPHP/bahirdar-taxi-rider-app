// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.
export default {
  expo: {
    owner: "zmichaeleth",
    name: 'Bahiran Ride',
    slug: 'BahirdarRide',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#00674F',
      android12: {
        image: './assets/icon.png',
        backgroundColor: '#00674F',
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bahirdar.ride',
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: true,
        },
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#00674F',
      },

      package: 'com.bahirdar.rider',
      usesCleartextTraffic: true,
      // INSA Finding 1 (CWE-538): forbid ADB/cloud backup extraction of the
      // app sandbox — this app stores auth tokens and PII.
      allowBackup: false,
      // minSdk/targetSdk are NOT set here — prebuild ignores these keys.
      // They are enforced via the expo-build-properties plugin below.
      permissions: [
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.INTERNET',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    androidStatusBar: {
      barStyle: 'light-content',
      backgroundColor: '#00674F',
      translucent: false,
    },
    web: {
      favicon: './assets/icon.png',
    },
    notification: {
      icon: './assets/icon.png',
      color: '#00674F',
    },
    plugins: [
      [
        // INSA Finding 4 (CWE-1104): minSdk 28 gives hardware-backed Keystore
        // (strengthens Finding 3); target/compile 36 is the Expo SDK 54
        // default and meets Play policy (API 36 required from Aug 31, 2026).
        'expo-build-properties',
        {
          android: {
            minSdkVersion: 28,
            compileSdkVersion: 36,
            targetSdkVersion: 36,
          },
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/icon.png',
          color: '#00674F',
          defaultChannel: 'trip-updates',
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Bahiran Ride to use your location.',
        },
      ],
      '@react-native-community/datetimepicker',
      '@maplibre/maplibre-react-native',
      'expo-secure-store',
    ],
    extra: {
      apiUrl:         process.env.EXPO_PUBLIC_API_URL,
      socketUrl:      process.env.EXPO_PUBLIC_SOCKET_URL,
      googleMapsKey:  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      osrmAddisUrl:   process.env.EXPO_PUBLIC_OSRM_ADDIS_URL,
      osrmBahirdarUrl: process.env.EXPO_PUBLIC_OSRM_BAHIRDAR_URL,
      "eas": {
        "projectId": "2fe9c462-da5d-437a-91bb-b56a4c48e258"
      }
    },
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/2fe9c462-da5d-437a-91bb-b56a4c48e258',
      enabled: true,
      fallbackToCacheTimeout: 0,
    },
  },
};
