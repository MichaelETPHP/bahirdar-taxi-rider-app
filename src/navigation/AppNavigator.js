import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import HomeScreen from '../screens/home/HomeScreen';
import SearchScreen from '../screens/home/SearchScreen';
import ConfirmRideScreen from '../screens/home/ConfirmRideScreen';
import SearchingScreen from '../screens/home/SearchingScreen';
import DriverMatchedScreen from '../screens/home/DriverMatchedScreen';
import TripActiveScreen from '../screens/home/TripActiveScreen';
import TripCompleteScreen from '../screens/home/TripCompleteScreen';
import DriverArrivedScreen from '../screens/home/DriverArrivedScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import RideHistoryScreen from '../screens/profile/RideHistoryScreen';
import NotificationScreen from '../screens/profile/NotificationScreen';
import SupportScreen from '../screens/profile/SupportScreen';
import LanguageScreen from '../screens/profile/LanguageScreen';
import EmergencyContactScreen from '../screens/profile/EmergencyContactScreen';
import SavedPlaceScreen from '../screens/profile/SavedPlaceScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerShown: false,
  lazy: true,
  animationEnabled: true,
};

export default function AppNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ lazy: false }} />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ presentation: 'modal', lazy: true }}
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
    </Stack.Navigator>
  );
}
