import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import useAuthStore from '../store/authStore';
import useSessionManager from '../hooks/useSessionManager';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loadTokens = useAuthStore((s) => s.loadTokens);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Initialize 30-day session management with app lifecycle tracking
  useSessionManager();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Load existing session (30-day persistent login)
        const hasValidSession = await loadTokens();

        if (hasValidSession) {
          console.log('[Auth] Session restored from AsyncStorage');
        } else {
          console.log('[Auth] No valid session found, user needs to login');
        }
      } catch (err) {
        console.error('[Auth] Failed to load tokens:', err);
      } finally {
        setBootstrapped(true);
      }
    };

    bootstrap();
  }, [loadTokens]);

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
