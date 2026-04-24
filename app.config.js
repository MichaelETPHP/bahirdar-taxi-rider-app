// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.
export default {
  expo: {
    owner: "michaelexpo12",
    name: 'Bahiran Ride',
    slug: 'BahirdarRide',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/bahiranLogo.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/bahiranLogo.png',
      resizeMode: 'contain',
      backgroundColor: '#00674F',
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
      },
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#00674F',
      },
      package: 'com.bahirdar.ride',
      usesCleartextTraffic: true,
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
      favicon: './assets/favicon.png',
    },
    notification: {
      icon: './assets/android-icon-monochrome.png',
      color: '#00674F',
    },
    plugins: [
      [
        'expo-notifications',
        {
          icon: './assets/android-icon-monochrome.png',
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
      apiUrl: process.env.EXPO_PUBLIC_API_URL,
      socketUrl: process.env.EXPO_PUBLIC_SOCKET_URL,
      googleMapsKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      osrmAddisUrl: process.env.EXPO_PUBLIC_OSRM_ADDIS_URL,
      osrmBahirdarUrl: process.env.EXPO_PUBLIC_OSRM_BAHIRDAR_URL,
      eas: {
        projectId: "0e88c993-9f78-4d5e-86fa-face25d64343"
      }
    },
  },
};