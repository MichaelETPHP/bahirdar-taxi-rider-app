// app.config.js — replaces app.json so we can inject env vars at build time.
// All EXPO_PUBLIC_* vars are available here via process.env.

// Only the "development" eas.json profile points at a plain-http local IP
// (for `expo start` iteration); preview/production always use the https
// taxiapi.zmichael.click API. ATS is only disabled for that http case — an
// App Store production build never carries NSAllowsArbitraryLoads, since
// Apple review can flag it as an unjustified security downgrade.
const usesInsecureApi = (process.env.EXPO_PUBLIC_API_URL || '').startsWith('http://');

// Expo's Android Google Maps config plugin silently OMITS the
// com.google.android.geo.API_KEY meta-data tag (no error, no warning) when
// this is empty — the app then builds and installs fine, but crashes the
// instant a map screen mounts with "API key not found". Failing loudly here
// at config-resolution time, instead of at runtime on a user's phone, is the
// whole point — this must throw before any build (dev, preview, production)
// can ship without it.
if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY) {
  throw new Error(
    'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is missing — Android build would install ' +
    'but crash on first map screen. Set it in the eas.json build profile (or ' +
    '.env.development for `expo start`) before continuing.'
  );
}

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
        ...(usesInsecureApi ? {
          NSAppTransportSecurity: { NSAllowsArbitraryLoads: true },
        } : {}),
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
          // Foreground-only — the app never calls
          // requestBackgroundPermissionsAsync(), so it must not declare an
          // Always-location usage string. Apple review checks that the
          // permission you request on-device matches what you declared.
          locationWhenInUsePermission:
            'Bahiran Ride uses your location to match you with nearby drivers and show your trip route in real time.',
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
          // react-native-maps ships its OWN Android config plugin
          // (node_modules/react-native-maps/plugin/build/android.js), which
          // takes over from Expo's standard android.config.googleMaps.apiKey
          // mechanism entirely — that field is silently ignored once this
          // plugin is present. It reads androidGoogleMapsApiKey specifically;
          // without it, its else-branch actively REMOVES any existing
          // com.google.android.geo.API_KEY meta-data tag from the manifest,
          // which is exactly what caused a "API key not found" crash on
          // Android despite EXPO_PUBLIC_GOOGLE_MAPS_API_KEY being set.
          androidGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
          // Separate iOS-restricted key — EXPO_PUBLIC_GOOGLE_MAPS_API_KEY is
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
      [
        '@stripe/stripe-react-native',
        {
          // Diaspora wallet top-up (card / Apple Pay / Google Pay). Adds the
          // Apple Pay entitlement + merchant ID at build time — must match
          // the Merchant ID registered in the Apple Developer account and
          // linked in the Stripe Dashboard (Settings > Payment methods >
          // Apple Pay), or Apple Pay confirmation fails at runtime.
          merchantIdentifier: 'merchant.com.bahirdar.ride',
          enableGooglePay: true,
        },
      ],
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
