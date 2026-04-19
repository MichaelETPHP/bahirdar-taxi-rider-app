import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SectionList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import { mockLocations } from '../../data/mockLocations';
import useLocationStore from '../../store/locationStore';
import { searchPlaces } from '../../services/gebetaMaps';
import { GEBETA_KEY } from '../../config/api';

const SEARCH_DEBOUNCE_MS = 350;

// Popular Addis Ababa landmarks always shown before user types
const ADDIS_POPULAR = [
  { id: 'p1', name: 'Bole International Airport', address: 'Bole, Addis Ababa', lat: 8.9779, lng: 38.7993 },
  { id: 'p2', name: 'Meskel Square',               address: 'Meskel Square, Addis Ababa', lat: 9.0108, lng: 38.7612 },
  { id: 'p3', name: 'Edna Mall',                   address: 'Bole Road, Addis Ababa', lat: 9.0056, lng: 38.7782 },
  { id: 'p4', name: 'Mercato Market',               address: 'Merkato, Addis Ababa', lat: 9.0264, lng: 38.7369 },
  { id: 'p5', name: 'Addis Ababa University',       address: 'Sidist Kilo, Addis Ababa', lat: 9.0381, lng: 38.7632 },
  { id: 'p6', name: 'Sheraton Addis',               address: 'Taitu Street, Addis Ababa', lat: 9.0175, lng: 38.7677 },
  { id: 'p7', name: 'Black Lion Hospital',          address: 'Lideta, Addis Ababa', lat: 9.0339, lng: 38.7601 },
  { id: 'p8', name: 'National Museum Ethiopia',     address: 'King George VI St, Addis Ababa', lat: 9.0308, lng: 38.7614 },
  { id: 'p9', name: 'Piassa',                       address: 'Piazza, Addis Ababa', lat: 9.0355, lng: 38.7530 },
  { id: 'p10', name: 'Bole Medhanealem',            address: 'Bole, Addis Ababa', lat: 9.0021, lng: 38.7872 },
  { id: 'p11', name: 'Mexico Square',               address: 'Mexico, Addis Ababa', lat: 9.0192, lng: 38.7463 },
  { id: 'p12', name: 'Sar Bet',                     address: 'Sar Bet, Addis Ababa', lat: 9.0080, lng: 38.7700 },
  { id: 'p13', name: '4 Kilo',                      address: 'Sidist Kilo, Addis Ababa', lat: 9.0350, lng: 38.7630 },
  { id: 'p14', name: 'Kazanchis',                   address: 'Kazanchis, Addis Ababa', lat: 9.0125, lng: 38.7630 },
  { id: 'p15', name: 'Megenagna',                   address: 'Megenagna, Addis Ababa', lat: 9.0273, lng: 38.8015 },
  { id: 'p16', name: 'CMC',                         address: 'CMC, Addis Ababa', lat: 9.0450, lng: 38.8094 },
  { id: 'p17', name: 'Gerji',                       address: 'Gerji, Addis Ababa', lat: 9.0028, lng: 38.8100 },
  { id: 'p18', name: 'Summit',                      address: 'Summit, Addis Ababa', lat: 8.9898, lng: 38.8050 },
  { id: 'p19', name: 'Gotera',                      address: 'Gotera, Addis Ababa', lat: 9.0037, lng: 38.7648 },
  { id: 'p20', name: 'Lebu',                        address: 'Lebu, Addis Ababa', lat: 8.9691, lng: 38.7301 },
];

const CATEGORY_ICONS = {
  transport: 'plane',
  landmark:  'landmark',
  shopping:  'shopping-bag',
  education: 'graduation-cap',
  hospital:  'hospital',
  hotel:     'hotel',
};

export default function SearchScreen({ navigation, route }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const { setDestination, setStop, addToRecentDestination, recentDestinations } = useLocationStore();
  const searchMode = route?.params?.mode ?? 'destination';
  const stopIndex  = route?.params?.stopIndex ?? -1;

  // Search when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Local Addis list — always fast, always available
        const localMatches = ADDIS_POPULAR.filter(
          (l) =>
            l.name.toLowerCase().includes(query.toLowerCase()) ||
            l.address.toLowerCase().includes(query.toLowerCase())
        );
        // Gebeta Maps API search (if key available)
        let apiResults = [];
        if (GEBETA_KEY) {
          apiResults = await searchPlaces(query.trim());
        }
        // Merge: API results first, then local matches not already included
        const apiIds = new Set(apiResults.map((p) => p.id));
        const merged = [
          ...apiResults,
          ...localMatches.filter((l) => !apiIds.has(l.id)),
        ];
        setResults(merged.length > 0 ? merged : localMatches);
      } catch {
        const localMatches = ADDIS_POPULAR.filter(
          (l) =>
            l.name.toLowerCase().includes(query.toLowerCase()) ||
            l.address.toLowerCase().includes(query.toLowerCase())
        );
        setResults(localMatches);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const handleSelect = useCallback(async (item) => {
    if (item.lat == null || item.lng == null) return;
    setSelecting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      addToRecentDestination(item);
      if (searchMode === 'stop' && stopIndex >= 0) {
        setStop(stopIndex, item);
      } else {
        setDestination(item);
      }
      navigation.goBack();
    } finally {
      setSelecting(false);
    }
  }, [addToRecentDestination, setDestination, setStop, searchMode, stopIndex, navigation]);

  const renderPlace = useCallback(({ item, section }) => {
    const icon = CATEGORY_ICONS[item.category] || 'map-marker-alt';
    const isRecent = section?.key === 'recent';
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        disabled={selecting}
      >
        <View style={[styles.itemIcon, isRecent && styles.itemIconRecent]}>
          <FontAwesome5
            name={isRecent ? 'history' : icon}
            size={15}
            color={isRecent ? colors.textSecondary : colors.primary}
            solid
          />
        </View>
        <View style={styles.itemText}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {!!item.address && (
            <Text style={styles.itemAddress} numberOfLines={1}>{item.address}</Text>
          )}
        </View>
        <FontAwesome5 name="chevron-right" size={12} color={colors.border} solid />
      </TouchableOpacity>
    );
  }, [handleSelect, selecting]);

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{section.title}</Text>
    </View>
  ), []);

  // Build sections for empty-query view
  const sections = [];
  if (recentDestinations.length > 0) {
    sections.push({ key: 'recent', title: 'Recent', data: recentDestinations.slice(0, 4) });
  }
  sections.push({ key: 'popular', title: 'Popular in Addis Ababa', data: ADDIS_POPULAR });

  const isSearching = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
          style={styles.backBtn}
        >
          <FontAwesome5 name="chevron-left" size={18} color={colors.textPrimary} solid />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <FontAwesome5 name="search" size={14} color={colors.primary} style={styles.inputIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Search in Addis Ababa…"
            placeholderTextColor={colors.textSecondary}
            value={query}
            onChangeText={setQuery}
            autoFocus
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {loading && <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />}
          {!loading && query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={styles.clearBtn}>
              <FontAwesome5 name="times-circle" size={16} color={colors.textSecondary} solid />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Selecting overlay */}
      {selecting && (
        <View style={styles.selectingOverlay}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.selectingText}>Getting location…</Text>
        </View>
      )}

      {/* Results when searching */}
      {isSearching ? (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id || item.placeId || item.name}
          renderItem={({ item }) => renderPlace({ item, section: {} })}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            !loading ? (
              <View style={styles.noResults}>
                <FontAwesome5 name="search" size={32} color={colors.border} />
                <Text style={styles.noResultsText}>No results for "{query}"</Text>
                <Text style={styles.noResultsSub}>Try a neighbourhood, landmark or street in Addis Ababa</Text>
              </View>
            ) : null
          }
        />
      ) : (
        /* Popular / Recent when not searching */
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || item.placeId || item.name}
          renderItem={renderPlace}
          renderSectionHeader={renderSectionHeader}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={14}
          maxToRenderPerBatch={14}
          windowSize={10}
          updateCellsBatchingPeriod={50}
          removeClippedSubviews
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },

  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.white,
    gap: 10,
    ...shadow.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 12,
  },
  inputIcon: { marginRight: 8 },
  input: {
    flex: 1,
    height: 42,
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  spinner: { marginLeft: 8 },
  clearBtn: { padding: 4 },

  selectingOverlay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    backgroundColor: `${colors.primary}10`,
    gap: 8,
  },
  selectingText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },

  list: { paddingBottom: 40 },

  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },

  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    backgroundColor: colors.white,
  },
  itemIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemIconRecent: {
    backgroundColor: colors.backgroundAlt,
  },
  itemText: { flex: 1 },
  itemName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  itemAddress: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },

  noResults: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 12,
    paddingHorizontal: 40,
  },
  noResultsText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  noResultsSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
