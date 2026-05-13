import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';
import { env } from '../../config/env';

const BASE_BANNER_HEIGHT = 40;

export default function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  
  const TOTAL_HEIGHT = BASE_BANNER_HEIGHT + insets.top;
  const slideAnim = useRef(new Animated.Value(-TOTAL_HEIGHT)).current;
  const prevOffline = useRef(false);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const healthUrl = env.apiUrl.includes('/api/v1') 
          ? env.apiUrl.replace('/api/v1', '/api/v1/health')
          : `${env.apiUrl}/health`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2500);
        
        const response = await fetch(healthUrl, {
          method: 'GET',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const connected = response.ok;
        const currentOffline = !connected;

        if (prevOffline.current && !currentOffline) {
          setShowConnected(true);
          setTimeout(() => {
            setShowConnected(false);
          }, 3000);
        }

        setIsOffline(currentOffline);
        prevOffline.current = currentOffline;
      } catch (e) {
        setIsOffline(true);
        prevOffline.current = true;
      }
    };

    checkNetwork();
    const interval = setInterval(checkNetwork, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const shouldShow = isOffline || showConnected;
    Animated.timing(slideAnim, {
      toValue: shouldShow ? 0 : -TOTAL_HEIGHT,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [isOffline, showConnected, TOTAL_HEIGHT]);

  return (
    <>
      <Animated.View 
        style={[
          styles.container, 
          { 
            height: TOTAL_HEIGHT,
            transform: [{ translateY: slideAnim }],
            backgroundColor: showConnected ? colors.success : colors.error 
          }
        ]}
      >
        <View style={[styles.banner, { paddingTop: insets.top }]}>
          {showConnected ? (
            <>
              <View style={styles.dot} />
              <Text style={styles.text}>Internet Restored</Text>
            </>
          ) : (
            <>
              <WifiOff size={14} color="white" />
              <Text style={styles.text}>No Internet Connection</Text>
            </>
          )}
        </View>
      </Animated.View>

      {isOffline && !showConnected && (
        <View style={styles.interactionBlocker} pointerEvents="auto">
          <View style={styles.blurSim} />
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100001,
  },
  banner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  interactionBlocker: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.05)',
    zIndex: 100000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  blurSim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  text: {
    color: 'white',
    fontSize: 12,
    fontWeight: fontWeight.bold,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 2,
  }
});

