import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Updates from 'expo-updates';
import { clearTransientRuntimeCaches } from '../../services/runtimeCacheRecovery';

export default class AppErrorBoundary extends React.Component {
  state = { hasError: false, restarting: false };

  static getDerivedStateFromError() {
    return { hasError: true, restarting: false };
  }

  componentDidCatch(error, info) {
    if (__DEV__) console.error('[App] Render recovery boundary:', error, info?.componentStack);
  }

  restart = async () => {
    this.setState({ restarting: true });
    clearTransientRuntimeCaches();
    try {
      if (Updates.isEnabled) {
        await Updates.reloadAsync();
        return;
      }
    } catch (error) {
      if (__DEV__) console.warn('[App] Update reload failed:', error?.message ?? error);
    }
    this.setState({ restarting: false });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={styles.container}>
        <Text style={styles.title}>Bahiran Ride needs to restart</Text>
        <Text style={styles.message}>
          We hit a loading problem. Your account and saved trip details are still on this device.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={this.restart}
          disabled={this.state.restarting}
          style={styles.button}
        >
          <Text style={styles.buttonText}>{this.state.restarting ? 'Restarting...' : 'Restart app'}</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', padding: 28, backgroundColor: '#F7F9FC' },
  title: { color: '#152238', fontSize: 21, fontWeight: '700', textAlign: 'center' },
  message: { marginTop: 10, color: '#536276', fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 340 },
  button: { minHeight: 48, minWidth: 150, marginTop: 24, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, borderRadius: 8, backgroundColor: '#2F70C7' },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
