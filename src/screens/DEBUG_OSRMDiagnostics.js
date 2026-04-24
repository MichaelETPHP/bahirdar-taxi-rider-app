import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../constants/colors';
import { fontSize, fontWeight } from '../constants/typography';
import { runOSRMDiagnostics, testOSRMRoute, testOSRMConnection } from '../utils/osrmDiagnostics';

export default function DEBUG_OSRMDiagnostics({ navigation }) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState('');

  const handleRunDiagnostics = async () => {
    setLoading(true);
    setResults('Running diagnostics...\n\n');

    // Capture console logs
    const logs = [];
    const originalLog = console.log;
    const originalError = console.error;
    const originalWarn = console.warn;

    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };
    console.error = (...args) => {
      logs.push('❌ ' + args.join(' '));
      originalError(...args);
    };
    console.warn = (...args) => {
      logs.push('⚠️  ' + args.join(' '));
      originalWarn(...args);
    };

    try {
      await runOSRMDiagnostics();
    } finally {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;

      setResults(logs.join('\n'));
      setLoading(false);
    }
  };

  const handleTestAddis = async () => {
    setLoading(true);
    setResults('Testing Addis OSRM...\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      const ok = await testOSRMConnection('http://192.168.1.8:5000');
      if (ok) {
        await testOSRMRoute('http://192.168.1.8:5000');
      }
    } finally {
      console.log = originalLog;
      setResults(logs.join('\n'));
      setLoading(false);
    }
  };

  const handleTestBahirdar = async () => {
    setLoading(true);
    setResults('Testing Bahir Dar OSRM...\n');

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => {
      logs.push(args.join(' '));
      originalLog(...args);
    };

    try {
      const ok = await testOSRMConnection('http://192.168.1.8:5001');
      if (ok) {
        await testOSRMRoute('http://192.168.1.8:5001');
      }
    } finally {
      console.log = originalLog;
      setResults(logs.join('\n'));
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>OSRM Diagnostics</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleRunDiagnostics}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.buttonText}>🔧 Run Full Diagnostics</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleTestAddis}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🧪 Test Addis OSRM (5000)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.buttonSecondary]}
          onPress={handleTestBahirdar}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🧪 Test Bahir Dar OSRM (5001)</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        <Text style={styles.results}>{results}</Text>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          If OSRM is failing, make sure Docker containers are running on 192.168.1.8
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  buttonContainer: {
    padding: 16,
    gap: 10,
  },
  button: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonSecondary: {
    backgroundColor: colors.mapCurrentLocation,
  },
  buttonText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  results: {
    color: '#00ff00',
    fontSize: fontSize.xs,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.backgroundSecondary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
});
