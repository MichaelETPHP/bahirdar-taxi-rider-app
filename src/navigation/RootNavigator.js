import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import useAuthStore from '../store/authStore';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadTokens = useAuthStore((s) => s.loadTokens);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    loadTokens().finally(() => setBootstrapped(true));
  }, []);

  // Wait until tokens are loaded before rendering navigation
  if (!bootstrapped) return null;

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false, animationEnabled: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="AppNav" component={AppNavigator} />
        ) : (
          <Stack.Screen name="AuthNav" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
