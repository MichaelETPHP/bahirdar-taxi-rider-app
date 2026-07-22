/**
 * VersionFooter — shows installed app version + build number, e.g. "1.1.0 (11)",
 * with a status dot: green = running the latest available update,
 * red = a newer update exists (this install is old), gray = still checking.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export default function VersionFooter() {
  const [isLatest, setIsLatest] = useState(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Dev builds / Expo Go can't check the update server — treat as current
        if (__DEV__ || !Updates.isEnabled) {
          if (mounted) setIsLatest(true);
          return;
        }
        const result = await Updates.checkForUpdateAsync();
        if (mounted) setIsLatest(!result.isAvailable);
      } catch (e) {
        // Never alarm the user on a failed check
        if (mounted) setIsLatest(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  let nativeVersion = null;
  let nativeBuild = null;
  try {
    // Reliable source for installed version/build; guarded so a dev client
    // built before this module was added doesn't crash.
    const Application = require('expo-application');
    nativeVersion = Application.nativeApplicationVersion;
    nativeBuild = Application.nativeBuildVersion;
  } catch (e) { /* module not in this binary yet */ }

  const version = nativeVersion ?? Constants.expoConfig?.version ?? '?';
  const build = nativeBuild ?? Constants.nativeBuildVersion ?? (__DEV__ ? 'dev' : '?');
  const dotColor = isLatest == null ? '#CBD5E1' : isLatest ? '#16A34A' : '#DC2626';

  return (
    <View style={st.wrap}>
      <View style={[st.dot, { backgroundColor: dotColor }]} />
      <Text style={st.text}>v{version} ({build})</Text>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
});
