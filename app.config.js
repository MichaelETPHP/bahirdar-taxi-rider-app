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
    version: '1.1.4',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
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
      googleServicesFile: './google-services.json',
      // INSA Finding 1 (CWE-538): forbid ADB/cloud backup extraction of the
      // app sandbox — this app stores auth tokens and PII.
      allowBackup: false,
      // minSdk/targetSdk/usesCleartextTraffic are NOT set here — this
      // Expo SDK version silently ignores all three at this top level.
      // They only take effect via the expo-build-properties plugin below.
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
        // Real-device testing showed a killed app not waking for an
        // incoming-call push at all — Android's per-app battery
        // optimization (Doze/App Standby) throttling background execution
        // for apps that haven't been recently used is a well-documented
        // cause of exactly this on stock/Samsung Android, independent of
        // anything in this app's own JS. This permission is what lets the
        // app ASK the user to exempt it (see requestBatteryOptimizationExemption
        // in src/utils/batteryOptimization.js) — merely declaring it changes
        // nothing on its own, the user must still grant it via the system
        // dialog this launches.
        'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
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
        // Replaces the legacy top-level `splash` key, which SDK 54 mostly
        // ignores on Android — that gap was the native white cold-start
        // flash between the launcher icon and this image ever appearing,
        // regardless of the color configured there. This plugin also sets
        // the root Activity's window background to the same blue, so even
        // the very first native frame (before this image itself decodes)
        // is on-brand instead of white.
        'expo-splash-screen',
        {
          image: './assets/splash.png',
          resizeMode: 'cover',
          backgroundColor: '#2F70C7',
          dark: {
            image: './assets/splash.png',
            backgroundColor: '#2F70C7',
          },
          // Android-only override: the native cold-start icon (Android 12+
          // system SplashScreen, plus the pre-12 fallback) is a separate,
          // OS-controlled small centered icon — always small, never
          // full-screen, regardless of resizeMode. It is NOT the same asset
          // as the custom full-screen splash rendered by
          // src/screens/auth/SplashScreen.js, so this can't affect that.
          // Uses the same square logo as the launcher icon so it reads as a
          // clean round badge instead of a shrunk crop of splash.png.
          android: {
            image: './assets/icon.png',
            resizeMode: 'contain',
            imageWidth: 200,
            // White only for this brief icon screen — the big splash right
            // after it (src/screens/auth/SplashScreen.js) intentionally
            // stays blue; confirmed with the user that the resulting
            // white-to-blue flash between the two is expected.
            backgroundColor: '#FFFFFF',
            dark: {
              image: './assets/icon.png',
              backgroundColor: '#FFFFFF',
            },
          },
        },
      ],
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
            // Several vehicle-category icon URLs from the admin panel are
            // still http:// (only "Damas" is https:// today) — targetSdk 28+
            // blocks cleartext traffic by default, so without this every
            // http:// category icon silently fails to load and falls back
            // to the generic car icon. Ideally those URLs get migrated to
            // https:// too, but the app must not depend on that happening.
            usesCleartextTraffic: true,
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
      // Baked in at prebuild time (app.config.js is evaluated once, reliably,
      // by `expo prebuild`) into the native Constants blob — unlike a raw
      // process.env.EXPO_PUBLIC_* reference inside application JS, which
      // depends on the separate `createBundleReleaseJsAndAssets` bundling
      // step also having these vars in ITS environment. That step has
      // silently produced a bundle missing these three specific values on
      // two separate real builds (1.1.7 and 1.1.9) despite the vars being
      // correctly exported in the build shell — this `extra` route is
      // immune to whatever's flaky about that step, matching the same
      // proven-reliable pattern already used for apiUrl/socketUrl/googleMapsKey above.
      stripePublishableKey: process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      googleWebClientId:    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleIosClientId:    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
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
