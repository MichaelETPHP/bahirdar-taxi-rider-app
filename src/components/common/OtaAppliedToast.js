import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CheckCircle2 } from 'lucide-react-native';
import * as Updates from 'expo-updates';

const APPLIED_UPDATE_KEY = 'bahiran-rider-last-applied-update';

export default function OtaAppliedToast() {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    let mounted = true;
    const announceAppliedUpdate = async () => {
      const updateId = Updates.updateId;
      if (!Updates.isEnabled || Updates.isEmbeddedLaunch || !updateId) return;

      const previousUpdateId = await AsyncStorage.getItem(APPLIED_UPDATE_KEY);
      if (previousUpdateId === updateId) return;
      await AsyncStorage.setItem(APPLIED_UPDATE_KEY, updateId);
      if (mounted) setVisible(true);
    };

    void announceAppliedUpdate().catch(() => {});
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 3 }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 180, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }, 3500);
    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [visible, opacity, translateY]);

  if (!visible) return null;
  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.toast, { bottom: insets.bottom + 18, opacity, transform: [{ translateY }] }]}
    >
      <View style={styles.content}>
        <CheckCircle2 size={20} color="#65D9A4" strokeWidth={2} />
        <Text style={styles.text}>App updated successfully</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: { position: 'absolute', alignSelf: 'center', maxWidth: '92%', zIndex: 10001, elevation: 10001 },
  content: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#123B31',
    borderWidth: 1,
    borderColor: '#28664F',
  },
  text: { color: '#FFFFFF', fontSize: 14, fontWeight: '600', flexShrink: 1 },
});
