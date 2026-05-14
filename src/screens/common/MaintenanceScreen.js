import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../../constants/colors';
import { fontWeight } from '../../constants/typography';

const MaintenanceScreen = ({ title, message, estimatedTime, contact, onRetry }) => (
  <View style={styles.container}>
    <StatusBar barStyle="light-content" />
    <SafeAreaView style={styles.content}>
      <Text style={styles.icon}>🔧</Text>
      <Text style={styles.title}>{title || 'Under Maintenance'}</Text>
      <Text style={styles.message}>{message || 'We are working on something amazing. Back soon!'}</Text>
      
      {estimatedTime && (
        <View style={styles.timeBox}>
          <Text style={styles.timeLabel}>Estimated time</Text>
          <Text style={styles.timeValue}>{estimatedTime}</Text>
        </View>
      )}

      <TouchableOpacity style={styles.retryBtn} onPress={onRetry}>
        <Text style={styles.retryText}>🔄 Try Again</Text>
      </TouchableOpacity>

      {contact && (
        <TouchableOpacity onPress={() => Linking.openURL(contact)}>
          <Text style={styles.contactText}>📱 Contact Support</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  </View>
);

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
  timeBox: {
    backgroundColor: '#161C18',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  timeLabel: {
    fontSize: 12,
    color: '#8A9E93',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: fontWeight.bold,
    color: colors.success || '#00674F',
  },
  retryBtn: {
    backgroundColor: colors.primary || '#00674F',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: fontWeight.semibold || '600',
  },
  contactText: {
    color: '#8A9E93',
    fontSize: 14,
    marginTop: 8,
  },
});

export default MaintenanceScreen;
