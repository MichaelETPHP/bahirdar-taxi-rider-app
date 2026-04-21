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
import {
  History,
  MapPin,
  ChevronRight,
  X,
  Search,
  XCircle,
  Plane,
  Landmark,
  ShoppingBag,
  GraduationCap,
  Hospital,
  Hotel,
} from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import { mockLocations } from '../../data/mockLocations';
import useLocationStore from '../../store/locationStore';
import { searchPlaces, getPlaceDetails } from '../../services/googlePlaces';

const SEARCH_DEBOUNCE_MS = 350;

// Popular Bahir Dar landmarks always shown before user types
const BAHIRDAR_POPULAR = [
  { id: 'p1', name: 'Bahir Dar Airport',     address: 'Ginbot 20, Bahir Dar', lat: 11.6033, lng: 37.3167 },
  { id: 'p2', name: 'Lake Tana Pier',        address: 'Shore Rd, Bahir Dar', lat: 11.5994, lng: 37.3892 },
  { id: 'p3', name: 'Bahir Dar University',  address: 'Peda Campus, Bahir Dar', lat: 11.5833, lng: 37.3833 },
  { id: 'p4', name: 'Blue Nile Falls',        address: 'Tis Abay, Bahir Dar', lat: 11.4851, lng: 37.5879 },
  { id: 'p5', name: 'Felege Hiwot Hospital', address: 'Hospital Rd, Bahir Dar', lat: 11.5912, lng: 37.3915 },
  { id: 'p6', name: 'Ghion Hotel',           address: 'Shore Rd, Bahir Dar', lat: 11.6012, lng: 37.3876 },
  { id: 'p7', name: 'St. George Church',     address: 'Piazza, Bahir Dar', lat: 11.6054, lng: 37.3850 },
  { id: 'p8', name: 'Abay River Bridge',     address: 'Main Highway, Bahir Dar', lat: 11.5975, lng: 37.4082 },
];

const CATEGORY_ICONS = {
  transport: Plane,
  landmark:  Landmark,
  shopping:  ShoppingBag,
  education: GraduationCap,
  hospital:  Hospital,
  hotel:     Hotel,
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
        // Local Bahir Dar list — always fast, always available
        const localMatches = BAHIRDAR_POPULAR.filter(
          (l) =>
            l.name.toLowerCase().includes(query.toLowerCase()) ||
            l.address.toLowerCase().includes(query.toLowerCase())
        );

        // Google Places search
        let apiResults = [];
        try {
          apiResults = await searchPlaces(query.trim());
        } catch (err) {
          console.warn('[SearchScreen] Google Places error:', err);
        }

        // Merge: API results first, then local matches not already included
        const apiIds = new Set(apiResults.map((p) => p.id));
        const merged = [
          ...apiResults,
          ...localMatches.filter((l) => !apiIds.has(l.id)),
        ];
        setResults(merged.length > 0 ? merged : localMatches);
      } catch (err) {
        console.error('[SearchScreen] Search error:', err);
        const localMatches = BAHIRDAR_POPULAR.filter(
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
    let finalItem = item;
    
    // If coordinates are missing (common for Google Places autocomplete results), fetch them
    if (finalItem.lat == null || finalItem.lng == null) {
      if (!finalItem.placeId) return;
      setSelecting(true);
      try {
        const details = await getPlaceDetails(finalItem.placeId);
        if (!details) return;
        finalItem = details;
      } catch (err) {
        console.warn('Place details error:', err);
        return;
      } finally {
        setLoading(false); // Clear search loading if any
      }
    }

    setSelecting(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      addToRecentDestination(finalItem);
      if (searchMode === 'stop' && stopIndex >= 0) {
        setStop(stopIndex, finalItem);
      } else {
        setDestination(finalItem);
      }
      navigation.goBack();
    } finally {
      setSelecting(false);
    }
  }, [addToRecentDestination, setDestination, setStop, searchMode, stopIndex, navigation]);

  const renderPlace = useCallback(({ item, section }) => {
    const IconComponent = isRecent => {
      if (isRecent) return History;
      return CATEGORY_ICONS[item.category] || MapPin;
    };
    const isRecent = section?.key === 'recent';
    const Icon = IconComponent(isRecent);
    return (
      <TouchableOpacity
        style={styles.item}
        onPress={() => handleSelect(item)}
        activeOpacity={0.7}
        disabled={selecting}
      >
        <View style={[styles.itemIcon, isRecent && styles.itemIconRecent]}>
          <Icon
            size={15}
            color={isRecent ? colors.textSecondary : colors.primary}
          />
        </View>
        <View style={styles.itemText}>
          <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
          {!!item.address && (
            <Text style={styles.itemAddress} numberOfLines={1}>{item.address}</Text>
          )}
        </View>
        <ChevronRight size={12} color={colors.border} />
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
  sections.push({ key: 'popular', title: 'Popular in Bahir Dar', data: BAHIRDAR_POPULAR });

  const isSearching = query.trim().length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Search bar */}
      <View style={styles.searchBar}>
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
          style={styles.backBtn}
        >
          <X size={18} color={colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.inputWrap}>
          <Search size={14} color={colors.primary} style={styles.inputIcon} />
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder={t('search.placeholder')}
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
              <XCircle size={16} color={colors.textSecondary} />
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
                <Search size={32} color={colors.border} />
                <Text style={styles.noResultsText}>No results for "{query}"</Text>
                <Text style={styles.noResultsSub}>Try a neighbourhood, landmark or street in Bahir Dar</Text>
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
