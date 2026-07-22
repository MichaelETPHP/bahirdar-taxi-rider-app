/**
 * RootBlockScreen — INSA: compromised devices never reach the app (rider).
 * Mirrors BahirdarDriver/components/security/RootBlockScreen.tsx.
 * Rendered INSTEAD of the navigator when the device is rooted, running
 * hooking frameworks, or is an emulator (production builds).
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function RootBlockScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.icon}>⚠️</Text>
        </View>
        <Text style={styles.title}>Access Blocked</Text>
        <Text style={styles.subtitle}>ደህንነት ማስጠንቀቂያ</Text>
        <Text style={styles.body}>
          This device appears to be rooted, modified, or running in an emulator.
          {'\n\n'}
          For the security of your account and payments, this application cannot
          run on modified devices.
          {'\n\n'}
          Please use an unmodified device, or contact support if you believe
          this is a mistake.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: '#991B1B',
    borderColor: '#F87171',
    borderWidth: 1,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#7F1D1D',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: { fontSize: 36 },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  subtitle: {
    color: '#FECACA',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  body: {
    color: '#FEE2E2',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
});
