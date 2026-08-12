import React, { useEffect } from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import * as Location from 'expo-location';

import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/home/SearchScreen';
import ConfirmRideScreen from '../screens/home/ConfirmRideScreen';
import SearchingScreen from '../screens/home/SearchingScreen';
import DriverMatchedScreen from '../screens/home/DriverMatchedScreen';
import TripActiveScreen from '../screens/home/TripActiveScreen';
import TripCompleteScreen from '../screens/home/TripCompleteScreen';
import DriverArrivedScreen from '../screens/home/DriverArrivedScreen';
import ActiveTripResumeScreen from '../screens/home/ActiveTripResumeScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import RideHistoryScreen from '../screens/profile/RideHistoryScreen';
import NotificationScreen from '../screens/profile/NotificationScreen';
import SupportScreen from '../screens/profile/SupportScreen';
import LanguageScreen from '../screens/profile/LanguageScreen';
import EmergencyContactScreen from '../screens/profile/EmergencyContactScreen';
import SavedPlaceScreen from '../screens/profile/SavedPlaceScreen';
import WalletScreen from '../screens/wallet/WalletScreen';
import WalletTopUpScreen from '../screens/wallet/WalletTopUpScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,
  lazy: true,
  animationEnabled: true,
};

export default function AppNavigator({ initialRouteName = 'Home' }) {
  useEffect(() => {
    // Request location permission when app loads
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission not granted');
        }
      } catch (error) {
        console.error('Failed to request location permission:', error);
      }
    })();
  }, []);

  return (
    <Stack.Navigator screenOptions={screenOptions} initialRouteName={initialRouteName}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ lazy: false }} />
      <Stack.Screen name="ActiveTripResume" component={ActiveTripResumeScreen} />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          presentation: 'modal',
          lazy: true,
          // Default card background is an opaque rectangle the exact size
          // of the screen — it was hiding SearchScreen's own rounded top
          // corners behind an identical white square. Transparent here lets
          // the rounded shape actually show as it slides up.
          cardStyle: { backgroundColor: 'transparent' },
          // `presentation: 'modal'` picks a different default transition per
          // platform — a full slide-up card on iOS vs. a fade-from-bottom on
          // Android — which would make the rounded-corner reveal look and
          // move differently on each. Forcing the same interpolator on both
          // keeps it consistent.
          cardStyleInterpolator: CardStyleInterpolators.forModalPresentationIOS,
        }}
      />
      <Stack.Screen name="ConfirmRide" component={ConfirmRideScreen} />
      <Stack.Screen name="Searching" component={SearchingScreen} />
      <Stack.Screen name="DriverMatched" component={DriverMatchedScreen} />
      <Stack.Screen name="DriverArrived" component={DriverArrivedScreen} />
      <Stack.Screen name="TripActive" component={TripActiveScreen} />
      <Stack.Screen name="TripComplete" component={TripCompleteScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="RideHistory" component={RideHistoryScreen} />
      <Stack.Screen name="Notification" component={NotificationScreen} />
      <Stack.Screen name="Support" component={SupportScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="EmergencyContact" component={EmergencyContactScreen} />
      <Stack.Screen name="SavedPlace" component={SavedPlaceScreen} />
      <Stack.Screen name="Wallet" component={WalletScreen} />
      <Stack.Screen
        name="WalletTopUp"
        component={WalletTopUpScreen}
        options={{ presentation: 'modal' }}
      />
    </Stack.Navigator>
  );
}
