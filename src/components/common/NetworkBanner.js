import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, Animated, SafeAreaView } from 'react-native';
import * as Network from 'expo-network';
import { WifiOff } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';

const BANNER_HEIGHT = 40;

export default function NetworkBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [showConnected, setShowConnected] = useState(false);
  const slideAnim = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const prevOffline = useRef(false);

  useEffect(() => {
    const checkNetwork = async () => {
      try {
        const state = await Network.getNetworkStateAsync();
        const connected = state.isConnected && state.isInternetReachable !== false;
        const currentOffline = !connected;

        // Detect transition from offline -> online
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
      toValue: shouldShow ? 0 : -BANNER_HEIGHT,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [isOffline, showConnected]);

  return (
    <>
      <Animated.View 
        style={[
          styles.container, 
          { 
            transform: [{ translateY: slideAnim }],
            backgroundColor: showConnected ? colors.primary : colors.error 
          }
        ]}
      >
        <SafeAreaView>
          <View style={styles.banner}>
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
        </SafeAreaView>
      </Animated.View>

      {/* Full screen interaction block when offline */}
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
    zIndex: 100001, // Above interaction blocker
  },
  banner: {
    height: BANNER_HEIGHT,
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
    backgroundColor: '#4ADE80', // Bright green dot
    marginRight: 2,
  }
});
