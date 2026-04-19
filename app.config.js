// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.
export default {
  expo: {
    owner: "michaelexpo12",
    name: 'Bahiran Ride',
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
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#00674F',
      },
      package: 'com.bahirdar.ride',
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyB2QAbjllEn-1S95xd5_LcrjeC2_-ugiRs',
        },
      },
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
            'Allow Bahiran Ride to use your location.',
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      apiUrl: process.env.EXPO_PUBLIC_API_URL || 'https://taxiapi.zmichael.click/api/v1',
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL || 'https://taxiapi.zmichael.click',
      googleMapsKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 'AIzaSyB2QAbjllEn-1S95xd5_LcrjeC2_-ugiRs',
      eas: {
        projectId: "0e88c993-9f78-4d5e-86fa-face25d64343"
      }
    },
  },
};