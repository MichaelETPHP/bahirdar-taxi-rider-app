/**
 * DEBUG SCREEN - Remove after fixing location issues
 * Shows exactly what's happening with location, geocoding, and search
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { GOOGLE_MAPS_KEY, API_BASE_URL } from '../config/api';
import { getCurrentLocation, reverseGeocode, searchPlaces, getPlaceDetails } from '../services/location.service';

export default function LocationDebugScreen() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (tag, message, type = 'info') => {
    console.log(`[${tag}] ${message}`);
    setLogs((prev) => [...prev, { tag, message, type, time: new Date().toLocaleTimeString() }]);
  };

  const testLocationPermission = async () => {
    setLoading(true);
    try {
      addLog('PERM', 'Requesting foreground permissions...');
      const { status } = await Location.requestForegroundPermissionsAsync();
      addLog('PERM', `Permission status: ${status}`, status === 'granted' ? 'success' : 'error');
    } catch (err) {
      addLog('PERM', `Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const testGetLocation = async () => {
    setLoading(true);
    try {
      addLog('LOC', 'Getting current location...');
      const location = await getCurrentLocation();
      addLog('LOC', `Success: lat=${location.lat}, lng=${location.lng}`, 'success');
      return location;
    } catch (err) {
      addLog('LOC', `Error: ${err.message}`, 'error');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const testReverseGeocode = async () => {
    setLoading(true);
    try {
      const location = await testGetLocation();
      if (!location) return;

      addLog('GEO', `Reverse geocoding: ${location.lat}, ${location.lng}`);
      const address = await reverseGeocode(location.lat, location.lng);
      addLog('GEO', `Address: ${address}`, 'success');
    } catch (err) {
      addLog('GEO', `Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const testSearch = async () => {
    setLoading(true);
    try {
      const location = await testGetLocation();
      if (!location) return;

      const query = 'Hotel';
      addLog('SEARCH', `Searching for "${query}" near ${location.lat}, ${location.lng}`);
      const results = await searchPlaces(query, location.lat, location.lng);
      addLog('SEARCH', `Found ${results.length} results`, 'success');

      if (results.length > 0) {
        addLog('SEARCH', `First result: ${results[0].mainText}`, 'success');
      }
    } catch (err) {
      addLog('SEARCH', `Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const testPlaceDetails = async () => {
    setLoading(true);
    try {
      const location = await testGetLocation();
      if (!location) return;

      const query = 'Bahir Dar';
      addLog('SEARCH', `Searching for "${query}"`);
      const results = await searchPlaces(query, location.lat, location.lng);

      if (results.length === 0) {
        addLog('PLACE', 'No results to get details for', 'error');
        setLoading(false);
        return;
      }

      const firstResult = results[0];
      addLog('PLACE', `Getting details for: ${firstResult.placeId}`);

      const details = await getPlaceDetails(firstResult.placeId);
      if (details) {
        addLog('PLACE', `Details: ${details.name} @ ${details.lat}, ${details.lng}`, 'success');
      } else {
        addLog('PLACE', 'Failed to get details', 'error');
      }
    } catch (err) {
      addLog('PLACE', `Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkEnvironment = () => {
    addLog('ENV', `API URL: ${API_BASE_URL}`);
    addLog('ENV', `Google Maps Key exists: ${!!GOOGLE_MAPS_KEY}`);
    addLog('ENV', `Google Maps Key length: ${GOOGLE_MAPS_KEY?.length || 0}`);
    addLog('ENV', `Expo Config available: ${!!Constants.expoConfig}`);
    addLog('ENV', `Expo extra: ${JSON.stringify(Constants.expoConfig?.extra)}`);
  };

  const clearLogs = () => setLogs([]);

  const getLogColor = (type) => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      default:
        return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>🔍 Location Debug</Text>
          <Text style={styles.subtitle}>Test each function individually</Text>
        </View>

        {/* Environment Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Environment</Text>
          <TouchableOpacity style={styles.button} onPress={checkEnvironment}>
            <Text style={styles.buttonText}>Check Configuration</Text>
          </TouchableOpacity>
        </View>

        {/* Permission */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Permission</Text>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={testLocationPermission}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Request Permission</Text>}
          </TouchableOpacity>
        </View>

        {/* Location */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Get Location</Text>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={testGetLocation}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Current Location</Text>}
          </TouchableOpacity>
        </View>

        {/* Reverse Geocode */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Reverse Geocode</Text>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={testReverseGeocode}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Get Address from Location</Text>}
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Search Places</Text>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={testSearch}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Search for Hotel</Text>}
          </TouchableOpacity>
        </View>

        {/* Place Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Get Place Details</Text>
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={testPlaceDetails}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Search & Get Details</Text>}
          </TouchableOpacity>
        </View>

        {/* Logs */}
        <View style={styles.section}>
          <View style={styles.logHeader}>
            <Text style={styles.sectionTitle}>Logs</Text>
            <TouchableOpacity onPress={clearLogs}>
              <Text style={styles.clearButton}>Clear</Text>
            </TouchableOpacity>
          </View>
          {logs.length === 0 ? (
            <Text style={styles.emptyLog}>No logs yet. Run tests above.</Text>
          ) : (
            logs.map((log, idx) => (
              <View key={idx} style={styles.logItem}>
                <Text style={[styles.logTime, { color: getLogColor(log.type) }]}>{log.time}</Text>
                <Text style={styles.logTag}>[{log.tag}]</Text>
                <Text style={[styles.logMessage, { color: getLogColor(log.type) }]}>{log.message}</Text>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    color: '#1f2937',
  },
  button: {
    backgroundColor: '#3b82f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  clearButton: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyLog: {
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  logItem: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  logTime: {
    fontSize: 11,
    fontWeight: '600',
    marginRight: 8,
    minWidth: 60,
  },
  logTag: {
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
    color: '#9ca3af',
    minWidth: 50,
  },
  logMessage: {
    fontSize: 11,
    flex: 1,
    fontFamily: 'monospace',
  },
});
