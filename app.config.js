// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.
export default {
  expo: {
    owner: "zmichaeleth",
    name: 'Bahiran Ride',
    slug: 'BahirdarRide',
    scheme: 'bahirdarride',
    version: '1.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#2F70C7',
      android12: {
        image: './assets/icon.png',
        backgroundColor: '#2F70C7',
      },
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bahirdar.ride',
      // Required alongside Google Sign-In per App Store rule 4.8 (any
      // third-party login on iOS must also offer Sign in with Apple).
      // Generates the com.apple.developer.applesignin entitlement at
      // prebuild/EAS-build time — needs a new build, not a JS-only change.
      usesAppleSignIn: true,
      config: {
        // Separate from EXPO_PUBLIC_GOOGLE_MAPS_API_KEY — that one is
        // restricted to Android apps in Google Cloud Console, so it can't
        // be reused here.
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
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
        backgroundColor: '#2F70C7',
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
        'android.permission.RECORD_AUDIO',
        // CallKeep's VoiceConnectionService calls TelecomManager.getPhoneAccount()
        // the instant an incoming call reaches the Telecom framework — without
        // this, that throws an uncaught SecurityException and kills the app.
        // Not added by @config-plugins/react-native-callkeep itself.
        'android.permission.READ_PHONE_NUMBERS',
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
        },
      },
    },
    androidStatusBar: {
      barStyle: 'light-content',
      backgroundColor: '#2F70C7',
      translucent: false,
    },
    web: {
      favicon: './assets/icon.png',
    },
    notification: {
      icon: './assets/icon.png',
      color: '#2F70C7',
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
          color: '#2F70C7',
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
      [
        '@react-native-google-signin/google-signin',
        {
          // Reversed form of the iOS OAuth Client ID — registers a URL scheme
          // so the sign-in flow can redirect back into the app after auth.
          iosUrlScheme: 'com.googleusercontent.apps.872882912380-f4bhhp9eqb4gi53dh38p9tb5ij4enacq',
        },
      ],
      [
        'react-native-maps',
        {
          // Android already gets its key from android.config.googleMaps.apiKey
          // (Expo's built-in manifest injection, no plugin needed there) — iOS
          // has no such built-in support; this plugin (react-native-maps >=1.22)
          // wires up the Google Maps iOS SDK + AppDelegate init. Uses a
          // separate iOS-restricted key — EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is
          // restricted to Android apps and can't serve iOS requests.
          iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_API_KEY,
        },
      ],
      [
        '@config-plugins/react-native-webrtc',
        {
          // In-app voice call to the driver (diaspora riders only) —
          // audio-only today; camera string still required by the plugin
          // schema even though video isn't used yet.
          cameraPermission: 'Bahiran Ride does not use your camera for voice calls.',
          microphonePermission: 'Allow Bahiran Ride to use your microphone for in-app voice calls with your driver.',
        },
      ],
      // Real native call UI (CallKit on iOS, ConnectionService on Android) so
      // an incoming in-app call rings and answers like a normal phone call,
      // including over the lock screen. No options — this plugin wires
      // everything (VoIP background mode, framework linking, Android
      // permissions/manifest services) automatically.
      '@config-plugins/react-native-callkeep',
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
