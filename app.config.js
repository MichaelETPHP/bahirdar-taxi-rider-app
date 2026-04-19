// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.
export default {
  expo: {
    owner: "zmichaeleth",
    name: 'Bahirdar',
    slug: 'BahirdarRide',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#00674F',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bahirdar.ride',
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#00674F',
      },
      package: 'com.bahirdar.ride',
      usesCleartextTraffic: true,
    },
    androidStatusBar: {
      barStyle: 'light-content',
      backgroundColor: '#00674F',
      translucent: false,
    },
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: [
      [
        'expo-notifications',
        {
          color: '#00674F',
          defaultChannel: 'default',
        },
      ],
      [
        'expo-location',
        {
          locationAlwaysAndWhenInUsePermission:
            'Allow Bahirdar to use your location.',
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL ||
        process.env.EXPO_PUBLIC_API_BASE_URL,
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
      gebetaMapsKey: process.env.EXPO_PUBLIC_GEBETA_MAPS_API_KEY,
      eas: {
        projectId: "2fe9c462-da5d-437a-91bb-b56a4c48e258"
      }
    },
  },
};