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
  Animated,
  Easing,
  Platform,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Search,
  X,
  Navigation,
  AlertCircle,
  ChevronRight,
  Home,
  Briefcase,
  Plus,
  Check,
} from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilySemiBold, fontFamilyMedium, fontFamilyRegular } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import useLocationStore from '../../store/locationStore';
import { searchPlaces, getPlaceDetails, detectCity } from '../../services/locationServiceV2';
import { saveSearchPlace, getSearchHistory, removeFromHistory, clearSearchHistory } from '../../services/searchHistoryService';

const SEARCH_DEBOUNCE_MS = 280;
const SEARCH_RADIUS_KM = 20; // tight city-level radius for place search bias

// City centers — used when userCoords not yet available
// Keys match the area field returned by detectCity (city.toLowerCase().replace(/\s+/g,''))
const CITY_CENTERS = {
  bahirdar:    { latitude: 11.5955, longitude: 37.3944 },
  addisababa:  { latitude: 9.0192,  longitude: 38.7469 },
};


function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function SearchScreen({ navigation }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [detectedCity, setDetectedCity] = useState(null); // 'bahirdar' | 'addis' | null
  // Save-as sheet state
  const [saveSheet, setSaveSheet] = useState(null); // { place } | null
  const [savedFeedback, setSavedFeedback] = useState(null); // 'home' | 'work' | null
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const shakeAnim = useRef(new Animated.Value(0)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;
  const saveSheetAnim = useRef(new Animated.Value(0)).current;

  const {
    setDestination, addToRecentDestination,
    recentDestinations, userCoords, pickup,
    savedPlaces, setSavedPlace,
  } = useLocationStore();

  // Resolve which city center to bias searches towards
  const getBiasCoords = useCallback(() => {
    if (userCoords?.latitude && userCoords?.longitude) {
      return { lat: userCoords.latitude, lng: userCoords.longitude };
    }
    // fallback: use detected city or Addis (matches HomeScreen default)
    const center = (detectedCity && CITY_CENTERS[detectedCity]) ? CITY_CENTERS[detectedCity] : CITY_CENTERS.addisababa;
    return { lat: center.latitude, lng: center.longitude };
  }, [userCoords, detectedCity]);

  // Detect city on mount
  useEffect(() => {
    const lat = userCoords?.latitude;
    const lng = userCoords?.longitude;
    if (!lat || !lng) return;
    detectCity(lat, lng).then((result) => {
      if (result?.area) setDetectedCity(result.area);
    });
  }, []);

  // Load search history
  useEffect(() => {
    getSearchHistory().then(setSearchHistory).catch(() => {});
  }, []);

  const handleDeleteHistoryItem = useCallback(async (placeId) => {
    await removeFromHistory(placeId).catch(() => {});
    setSearchHistory((prev) => prev.filter((p) => p.placeId !== placeId));
  }, []);

  const handleClearHistory = useCallback(async () => {
    await clearSearchHistory().catch(() => {});
    setSearchHistory([]);
  }, []);

  // Animate results in
  useEffect(() => {
    if (results.length > 0) {
      resultAnim.setValue(0);
      Animated.timing(resultAnim, {
        toValue: 1, duration: 200, useNativeDriver: true, easing: Easing.out(Easing.quad),
      }).start();
    }
  }, [results]);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const { lat, lng } = getBiasCoords();
        const apiResults = await searchPlaces(query.trim(), lat, lng, SEARCH_RADIUS_KM * 1000);
        setResults(
          apiResults.map((p) => ({
            placeId: p.placeId,
            name: p.mainText,
            address: p.secondaryText,
            description: p.description,
          })),
        );
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, getBiasCoords]);

  const shakeWarning = useCallback(() => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,  duration: 60, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim]);



  const resolveCoords = useCallback(async (item) => {
    if (item.lat != null && item.lng != null) return item;
    if (!item.placeId) return null;
    const details = await getPlaceDetails(item.placeId);
    return details || null;
  }, []);

  const handleSelect = useCallback(
    async (item, opts = {}) => {
      const { skipSavePrompt = false } = opts;
      setSelecting(true);

      let finalItem = await resolveCoords(item);
      if (!finalItem) { setSelecting(false); return; }

      // Destination is never restricted — riders can go anywhere (airport, nearby town, etc.)
      // The backend validates the PICKUP location against active service areas.

      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        await saveSearchPlace({
          placeId: finalItem.placeId,
          name: finalItem.name,
          address: finalItem.address,
          lat: finalItem.lat,
          lng: finalItem.lng,
        });
        addToRecentDestination(finalItem);

        setDestination(finalItem);

        navigation.goBack();
      } catch {
        navigation.goBack();
      } finally {
        setSelecting(false);
      }
    },
    [
      resolveCoords, addToRecentDestination, setDestination,
      navigation, getBiasCoords, shakeWarning,
    ],

  );

  // Splits `text` around every case-insensitive occurrence of `query` and
  // renders matching segments in emerald so the user can see exactly what matched.
  const HighlightText = useCallback(({ text = '', query: q = '', style }) => {
    if (!q) return <Text style={style} numberOfLines={1}>{text}</Text>;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    const lower = q.toLowerCase();
    return (
      <Text style={style} numberOfLines={1}>
        {parts.map((part, i) =>
          part.toLowerCase() === lower
            ? <Text key={i} style={styles.highlight}>{part}</Text>
            : part
        )}
      </Text>
    );
  }, []);

  const renderResult = useCallback(
    ({ item, section }) => {
      const isRecent = section?.key === 'recent' || section?.key === 'history';
      const IconComp = isRecent ? Clock : MapPin;
      const needle   = isRecent ? '' : query.trim();

      return (
        <TouchableOpacity
          style={styles.item}
          onPress={() => handleSelect(item)}
          activeOpacity={0.7}
          disabled={selecting}
        >
          <View style={[styles.itemIcon, isRecent && styles.itemIconRecent]}>
            <IconComp size={15} color={isRecent ? colors.textSecondary : colors.primary} />
          </View>
          <View style={styles.itemText}>
            <HighlightText text={item.name} query={needle} style={styles.itemName} />
            {!!item.address && (
              <HighlightText text={item.address} query={needle} style={styles.itemAddress} />
            )}
          </View>
          {isRecent ? (
            <TouchableOpacity
              onPress={() => handleDeleteHistoryItem(item.placeId)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              style={styles.deleteBtn}
            >
              <X size={14} color={colors.textSecondary} />
            </TouchableOpacity>
          ) : (
            <ChevronRight size={13} color={colors.border} />
          )}
        </TouchableOpacity>
      );
    },
    [handleSelect, selecting, query, handleDeleteHistoryItem],
  );

  const renderSectionHeader = useCallback(({ section }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{section.title}</Text>
      {section.key === 'history' && (
        <TouchableOpacity onPress={handleClearHistory} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.clearAllText}>Clear all</Text>
        </TouchableOpacity>
      )}
    </View>
  ), [handleClearHistory]);

  // Build sections for empty-query view
  const sections = [];
  if (searchHistory.length > 0) {
    sections.push({ key: 'history', title: 'Recent Searches', data: searchHistory });
  }
  if (recentDestinations.length > 0) {
    sections.push({ key: 'recent', title: 'Recent Destinations', data: recentDestinations });
  }

  const isSearching = query.trim().length > 0;
  const cityLabel   = detectedCity === 'bahirdar'   ? 'Bahir Dar'
                    : detectedCity === 'addisababa' ? 'Addis Ababa'
                    : 'your city';

  const hasSavedHome = !!savedPlaces?.home;
  const hasSavedWork = !!savedPlaces?.work;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            navigation.goBack();
          }}
          style={styles.backBtn}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ArrowLeft size={20} color={colors.textPrimary} />
        </TouchableOpacity>

        <View style={styles.searchBox}>
          {/* Pickup row (read-only) */}
          <View style={styles.pickupRow}>
            <View style={styles.dot} />
            <Text style={styles.pickupText} numberOfLines={1}>
              {pickup?.name || 'Current location'}
            </Text>
          </View>

          <View style={styles.searchDivider} />

          {/* Destination input */}
          <View style={styles.destRow}>
            <View style={[styles.dot, styles.dotDest]} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Where to?"
              placeholderTextColor={colors.textSecondary}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              selectionColor={colors.primary}
            />
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={styles.inputRight} />
            ) : query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} style={styles.inputRight}>
                <X size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>


      {/* Selecting overlay */}
      {selecting && (
        <View style={styles.selectingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.selectingText}>Getting location…</Text>
        </View>
      )}

      {/* Home / Work shortcuts removed as requested */}


      {/* City tag */}
      {!isSearching && detectedCity && (
        <View style={styles.cityTag}>
          <Navigation size={11} color={colors.primary} />
          <Text style={styles.cityTagText}>Showing places in {cityLabel}</Text>
        </View>
      )}

      {/* Results */}
      {isSearching ? (
        <Animated.View style={{ flex: 1, opacity: resultAnim }}>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id || item.placeId || item.name}
            renderItem={({ item }) => renderResult({ item, section: {} })}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={10}
            removeClippedSubviews
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              results.length > 0 ? (
                <View style={styles.searchResultsHeader}>
                  <Text style={styles.sectionLabel}>Search Results</Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.noResults}>
                  <View style={styles.noResultsIcon}>
                    <Search size={26} color={colors.border} />
                  </View>
                  <Text style={styles.noResultsTitle}>No places found</Text>
                  <Text style={styles.noResultsSub}>
                    Try a landmark, neighbourhood or street name in {cityLabel}
                  </Text>
                </View>
              ) : (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.primary} />
                  <Text style={styles.loadingText}>Searching {cityLabel}…</Text>
                </View>
              )
            }
          />
        </Animated.View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id || item.placeId || item.name}
          renderItem={renderResult}
          renderSectionHeader={renderSectionHeader}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={20}
          maxToRenderPerBatch={14}
          windowSize={10}
          removeClippedSubviews
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          ListEmptyComponent={
            <View style={styles.emptyHint}>
              <Text style={styles.emptyHintText}>Start typing a destination above</Text>
            </View>
          }
        />
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },

  // ── Header ─────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.background,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // ── Search box ──────────────────────────────────────────────────────────
  searchBox: {
    flex: 1,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  pickupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.mapCurrentLocation,
    flexShrink: 0,
  },
  dotDest: {
    backgroundColor: colors.mapDestination,
  },
  pickupText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: fontFamilyMedium,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  searchDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },
  destRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: fontSize.sm,
    fontFamily: fontFamilyMedium,
    color: colors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  inputRight: {
    padding: 4,
  },

  // ── Warning banner ──────────────────────────────────────────────────────
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FEF3C7',
    borderBottomWidth: 1,
    borderBottomColor: '#FDE68A',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  warningText: {
    flex: 1,
    fontSize: fontSize.xs,
    color: '#92400E',
    fontWeight: fontWeight.medium,
    lineHeight: 18,
  },

  // ── Selecting overlay ───────────────────────────────────────────────────
  selectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 8,
    backgroundColor: `${colors.primary}0D`,
    borderBottomWidth: 1,
    borderBottomColor: `${colors.primary}20`,
  },
  selectingText: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },

  // ── City tag ────────────────────────────────────────────────────────────
  cityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  cityTagText: {
    fontSize: fontSize.xs,
    fontFamily: fontFamilySemiBold,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
  },

  // ── Lists ───────────────────────────────────────────────────────────────
  list: { paddingBottom: 48 },
  searchResultsHeader: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: colors.background,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontFamily: fontFamilySemiBold,
    fontWeight: fontWeight.bold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // ── Result item ─────────────────────────────────────────────────────────
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
    backgroundColor: colors.background,
  },
  itemIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${colors.primary}15`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  itemIconRecent: {
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  itemText: { flex: 1, minWidth: 0 },
  itemName: {
    fontSize: fontSize.base,
    fontFamily: fontFamilySemiBold,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  highlight: {
    color: '#10b981',
    fontFamily: fontFamilySemiBold,
    fontWeight: fontWeight.bold,
  },
  deleteBtn: {
    padding: 4,
    marginLeft: 4,
  },
  clearAllText: {
    fontSize: fontSize.sm,
    fontFamily: fontFamilyMedium,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  itemAddress: {
    fontSize: fontSize.sm,
    fontFamily: fontFamilyRegular,
    color: colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
  },

  // ── Empty / loading states ──────────────────────────────────────────────
  noResults: {
    alignItems: 'center',
    paddingTop: 64,
    paddingHorizontal: 40,
    gap: 12,
  },
  noResultsIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  noResultsTitle: {
    fontSize: fontSize.md,
    fontFamily: fontFamilySemiBold,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  noResultsSub: {
    fontSize: fontSize.base,
    fontFamily: fontFamilyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
    gap: 10,
  },
  loadingText: {
    fontSize: fontSize.base,
    fontFamily: fontFamilyRegular,
    color: colors.textSecondary,
  },
  emptyHint: {
    alignItems: 'center',
    paddingTop: 32,
  },
  emptyHintText: {
    fontSize: fontSize.base,
    fontFamily: fontFamilyRegular,
    color: colors.textSecondary,
  },

  // Saved places row styles removed


  // ── Save-as bottom sheet ────────────────────────────────────────────────
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    paddingTop: 12,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 16 },
      android: { elevation: 16 },
    }),
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 18,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sheetSub: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  sheetActions: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 12,
  },
  sheetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    backgroundColor: colors.background,
  },
  sheetBtnIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}12`,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sheetBtnIconDone: {
    backgroundColor: colors.primary,
  },
  sheetBtnLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  sheetBtnSub: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sheetDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: 16,
  },
  sheetSkip: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  sheetSkipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontWeight: fontWeight.medium,
  },
});
