import React, { useEffect, useState } from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AuthNavigator from './AuthNavigator';
import AppNavigator from './AppNavigator';
import useAuthStore from '../store/authStore';
import useSessionManager from '../hooks/useSessionManager';

import SplashScreen from '../screens/auth/SplashScreen';
import NetworkBanner from '../components/common/NetworkBanner';

const Stack = createStackNavigator();
export const navigationRef = createNavigationContainerRef();

export default function RootNavigator() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const loadTokens = useAuthStore((s) => s.loadTokens);
  const [bootstrapped, setBootstrapped] = useState(false);
  const [splashFinished, setSplashFinished] = useState(false);

  // Initialize 30-day session management with app lifecycle tracking
  useSessionManager();

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Load existing session (30-day persistent login)
        await loadTokens();
      } catch (err) {
        console.error('[Auth] Failed to load tokens:', err);
      } finally {
        setBootstrapped(true);
      }
    };

    bootstrap();
  }, [loadTokens]);

  const handleSplashFinish = () => {
    setSplashFinished(true);
  };

  // ── Scenario 1: Still loading tokens or animation in progress ──
  if (!bootstrapped || !splashFinished) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  // ── Scenario 2: Bootstrapped and animation done → Show App ──
  return (
    <NavigationContainer ref={navigationRef}>
      <NetworkBanner />
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
