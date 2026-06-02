import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';

const BASE_BANNER_HEIGHT = 40;

// Checks REAL internet connectivity — not the local API server.
// Uses a reliable public DNS endpoint so it works regardless of API server state.
const INTERNET_CHECK_URL = 'https://dns.google/resolve?name=example.com&type=A';
const CHECK_TIMEOUT_MS   = 4000;
const CHECK_INTERVAL_MS  = 8000;  // every 8s is enough — was 5s which was too aggressive

async function hasRealInternet() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(INTERNET_CHECK_URL, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export default function NetworkBanner() {
  const insets = useSafeAreaInsets();
  const [isOffline, setIsOffline] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  const prevOffline = useRef(false);
  const mountedRef  = useRef(true);

  const TOTAL_HEIGHT = BASE_BANNER_HEIGHT + insets.top;
  const slideAnim   = useRef(new Animated.Value(-TOTAL_HEIGHT)).current;

  useEffect(() => {
    mountedRef.current = true;

    const checkNetwork = async () => {
      const online = await hasRealInternet();
      if (!mountedRef.current) return;

      if (!online) {
        setIsOffline(true);
        prevOffline.current = true;
      } else {
        // Was offline → now back online: show green "Restored" banner briefly
        if (prevOffline.current) {
          setShowConnected(true);
          setTimeout(() => {
            if (mountedRef.current) setShowConnected(false);
          }, 3000);
        }
        setIsOffline(false);
        prevOffline.current = false;
      }
    };

    // Small initial delay so app startup completes before the first check
    const initialTimer = setTimeout(checkNetwork, 1500);
    const interval = setInterval(checkNetwork, CHECK_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
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
            backgroundColor: showConnected ? colors.success : colors.error,
          },
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
    top: 0, left: 0, right: 0,
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
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: '#4ADE80',
    marginRight: 2,
  },
});
