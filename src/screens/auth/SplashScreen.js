import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import * as Network from 'expo-network';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }) {
  const [isOffline, setIsOffline] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  const [checking, setChecking] = useState(true);
  const logoScale = useRef(new Animated.Value(0.6)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const animationFinished = useRef(false);

  const checkConnectivity = async () => {
    try {
      setChecking(true);
      const state = await Network.getNetworkStateAsync();
      console.log('[Network] State:', JSON.stringify(state));
      
      let isActuallyConnected = state.isConnected;

      // If state says connected, do a "real world" ping check to be 100% sure
      if (isActuallyConnected) {
        try {
          console.log('[Network] Pinging 8.8.8.8...');
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3000);
          
          const response = await fetch('https://8.8.8.8', { 
            method: 'HEAD', 
            mode: 'no-cors',
            signal: controller.signal 
          });
          
          clearTimeout(timeoutId);
          console.log('[Network] Ping success');
          isActuallyConnected = true;
        } catch (e) {
          console.log('[Network] Ping failed:', e.message);
          isActuallyConnected = false;
        }
      }
      
      console.log('[Network] Final decision - isOffline:', !isActuallyConnected);
      setIsOffline(!isActuallyConnected);
      setHasChecked(true);
      
      // Crucial: Only exit splash if internet is confirmed AND animation is done
      if (isActuallyConnected && animationFinished.current) {
        console.log('[Splash] Both internet and animation ready. Proceeding...');
        if (onFinish) onFinish();
      }
    } catch (error) {
      console.error('[Network] Critical check failure:', error);
      setIsOffline(true);
      setHasChecked(true);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnectivity();
    
    // Check every 3 seconds while on splash screen to respond to cable changes
    const interval = setInterval(checkConnectivity, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(barWidth, {
        toValue: width * 0.6,
        duration: 2500,
        useNativeDriver: false,
      }),
    ]).start(() => {
      animationFinished.current = true;
      console.log('[Splash] Animation finished. checking internet...');
      
      // Re-trigger check to be sure, or proceed if already known good
      checkConnectivity();
    });
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Image
        source={require('../../../assets/splash.png')}
        style={styles.backgroundImage}
        contentFit="cover"
        transition={300}
        priority="high"
        cachePolicy="disk"
      />

      <View style={styles.content}>
        <View style={styles.topHalf} />

        <View style={styles.bottomHalf}>
          {!isOffline && (
            <>
              <View style={styles.barTrack}>
                <Animated.View style={[styles.barFill, { width: barWidth }]} />
              </View>
              <Text style={styles.loadingText}>Preparing your ride...</Text>
            </>
          )}
        </View>
      </View>

      {/* No Internet Overlay (Direct View instead of Modal) */}
      {hasChecked && isOffline && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.iconCircleLarge}>
              <WifiOff size={40} color={colors.error} />
            </View>
            
            <Text style={styles.modalTitle}>No Internet Connection</Text>
            <Text style={styles.modalBody}>
              Bahir Dar Ride requires an active internet connection to work properly. Please check your settings and try again.
            </Text>

            <TouchableOpacity 
              style={styles.retryBtn} 
              onPress={checkConnectivity}
              disabled={checking}
            >
              {checking ? (
                <Text style={styles.retryBtnText}>Checking...</Text>
              ) : (
                <>
                  <RefreshCw size={18} color="white" style={{ marginRight: 8 }} />
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 80,
  },
  topHalf: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomHalf: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  barTrack: {
    width: width * 0.6,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  barFill: {
    height: 4,
    backgroundColor: colors.white,
    borderRadius: 2,
  },
  loadingText: {
    marginTop: 12,
    fontSize: fontSize.sm,
    color: colors.white,
    fontWeight: fontWeight.medium,
  },
  // Modal Styles
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
    zIndex: 9999,
  },
  modalCard: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  iconCircleLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 14,
    borderRadius: 30,
  },
  retryBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: fontWeight.bold,
  },
});
