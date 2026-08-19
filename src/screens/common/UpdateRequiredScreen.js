import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';

const PLAY_STORE_FALLBACK = 'https://play.google.com/store/apps/details?id=com.bahirdar.rider';
const APP_STORE_FALLBACK = 'https://apps.apple.com/app/id0000000000';

const UpdateRequiredScreen = ({ updateUrl }) => {
  const openStore = async () => {
    const primary = updateUrl || (Platform.OS === 'ios' ? APP_STORE_FALLBACK : PLAY_STORE_FALLBACK);
    try {
      await Linking.openURL(primary);
    } catch {
      // market:// scheme fails when the Play Store app isn't installed
      // (e.g. an emulator) — fall back to the plain https listing URL.
      const fallback = Platform.OS === 'ios' ? APP_STORE_FALLBACK : PLAY_STORE_FALLBACK;
      Linking.openURL(fallback).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={styles.content}>
        <Text style={styles.icon}>⬆️</Text>
        <Text style={styles.title}>Update Required</Text>
        <Text style={styles.message}>
          A new version of Bahiran Ride is available. Please update to keep using the app.
        </Text>

        <TouchableOpacity style={styles.updateBtn} onPress={openStore} activeOpacity={0.85}>
          <Text style={styles.updateText}>Update Now</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F0C',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: '#8A9E93',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  updateBtn: {
    backgroundColor: colors.primary || '#2F70C7',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
  },
  updateText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: fontWeight.semibold || '600',
  },
});

export default UpdateRequiredScreen;
