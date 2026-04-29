import { useState, useCallback, useEffect, useRef } from 'react';
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
import useLocationStore from '../../store/locationStore';
import { searchPlaces, getPlaceDetails } from '../../services/locationServiceV2';
import { saveSearchPlace, getSearchHistory } from '../../services/searchHistoryService';

const SEARCH_DEBOUNCE_MS = 300;

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
  const [searchHistory, setSearchHistory] = useState([]);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  const { setDestination, setStop, addToRecentDestination, recentDestinations, userCoords } = useLocationStore();
  const searchMode = route?.params?.mode ?? 'destination';
  const stopIndex  = route?.params?.stopIndex ?? -1;

  // Load search history on mount
  useEffect(() => {
    (async () => {
      const history = await getSearchHistory();
      setSearchHistory(history);
    })();
  }, []);

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
        const lat = userCoords?.latitude || 11.5936;
        const lng = userCoords?.longitude || 37.3906;

        // Google Places search
        const apiResults = await searchPlaces(query.trim(), lat, lng);
        const formattedResults = apiResults.map(p => ({
          placeId: p.placeId,
          name: p.mainText,
          address: p.secondaryText,
          description: p.description
        }));

        setResults(formattedResults);
      } catch (err) {
        console.error('[SearchScreen] Search error:', err);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, userCoords]);

  const handleSelect = useCallback(async (item) => {
    let finalItem = item;

    setSelecting(true);

    // If coordinates are missing (common for Google Places autocomplete results), fetch them
    if (finalItem.lat == null || finalItem.lng == null) {
      if (!finalItem.placeId) {
        setSelecting(false);
        return;
      }
      try {
        console.log('[SearchScreen] Fetching place details for:', finalItem.placeId);
        const details = await getPlaceDetails(finalItem.placeId);
        if (!details) {
          console.warn('[SearchScreen] No details found');
          setSelecting(false);
          return;
        }
        finalItem = details;
        console.log('[SearchScreen] Got details:', details);
      } catch (err) {
        console.error('[SearchScreen] Place details error:', err);
        setSelecting(false);
        return;
      }
    }

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // Save to search history
      await saveSearchPlace({
        placeId: finalItem.placeId,
        name: finalItem.name,
        address: finalItem.address,
        lat: finalItem.lat,
        lng: finalItem.lng,
      });

      addToRecentDestination(finalItem);

      if (searchMode === 'stop' && stopIndex >= 0) {
        setStop(stopIndex, finalItem);
      } else {
        setDestination(finalItem);
      }

      console.log('[SearchScreen] Selected place:', finalItem);
      navigation.goBack();
    } catch (err) {
      console.error('[SearchScreen] Selection error:', err);
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
  if (searchHistory.length > 0) {
    sections.push({ key: 'history', title: 'Search History', data: searchHistory.slice(0, 5) });
  }
  if (recentDestinations.length > 0) {
    sections.push({ key: 'recent', title: 'Recent Destinations', data: recentDestinations.slice(0, 4) });
  }

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
                <Text style={styles.noResultsSub}>Try a neighbourhood, landmark or street in your city</Text>
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
