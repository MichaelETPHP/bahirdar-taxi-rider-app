// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.
export default {
  expo: {
    owner: "zmichaeleth",
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
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/icon.png',
        backgroundColor: '#00674F',
      },
      package: 'com.bahirdar.rider',
      usesCleartextTraffic: true,
      minSdkVersion: 21,
      targetSdkVersion: 34,
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
  },
};
