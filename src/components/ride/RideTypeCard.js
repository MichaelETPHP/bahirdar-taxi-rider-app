import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Modal, Pressable } from 'react-native';

import { TouchableOpacity } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Car, Van, Users, Info } from 'lucide-react-native';

import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';


const PALETTE = [
  { color: '#00674F', bgColor: '#E6F4F1' },
  { color: '#0369A1', bgColor: '#E0F2FE' },
  { color: '#7C3AED', bgColor: '#EDE9FE' },
  { color: '#B45309', bgColor: '#FEF3C7' },
];

const SHIMMER_TRANSLATE = { inputRange: [-1.5, 1.5], outputRange: [-450, 450] };
const WIGGLE_ROTATE     = { inputRange: [-1, 1],     outputRange: ['-15deg', '15deg'] };

const SHIMMER_GRADIENT_COLORS = [
  'transparent',
  'rgba(255,255,255,0.0)',
  'rgba(255,255,255,0.3)',
  'rgba(255,255,255,0.0)',
  'transparent',
];



function RideTypeCard({
  category,
  selected,
  onPress,
  distanceKm,
  durationMin,
  serverFare,
  serverBreakdown,   // fare_breakdown from server estimate
  arrivalEta,
  surge = 1,
  fareLoading = false,
  lang = 'en',
}) {

  const [showBreakdownModal, setShowBreakdownModal] = useState(false);



  const palette = useMemo(
    () => PALETTE[(category.display_order - 1) % PALETTE.length] || PALETTE[0],
    [category.display_order],
  );


  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);
  const label = lang === 'am' && category.name_am        ? category.name_am        : category.name;
  const desc  = lang === 'am' && category.description_am ? category.description_am : category.description;
  const fare  = serverFare != null ? parseFloat(serverFare) : null;
  const categoryImageUrl = category.image_url || category.imageUrl || category.imageURL || '';


  const shimmerPos = useRef(new Animated.Value(-1.5)).current;
  const wiggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!selected) {
      shimmerPos.setValue(-1.5);
      wiggleAnim.setValue(0);
      return undefined;
    }
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerPos, { toValue: 1.5, duration: 1800, useNativeDriver: true }),
        Animated.delay(2200),
      ]),
    );
    const wiggleLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(wiggleAnim, { toValue: 1,  duration: 200, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: -1, duration: 400, useNativeDriver: true }),
        Animated.timing(wiggleAnim, { toValue: 0,  duration: 200, useNativeDriver: true }),
        Animated.delay(1800),
      ]),
    );
    Animated.parallel([shimmerLoop, wiggleLoop]).start();
    return () => {
      shimmerLoop.stop();
      wiggleLoop.stop();
    };
  }, [selected, shimmerPos, wiggleAnim]);

  const shimmerTranslateX = shimmerPos.interpolate(SHIMMER_TRANSLATE);
  const wiggleRotate      = wiggleAnim.interpolate(WIGGLE_ROTATE);

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const handlePress = useCallback(async () => {
    // Fast "Swallow" Animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.96, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 150, friction: 10, useNativeDriver: true }),
    ]).start();

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [onPress, scaleAnim]);

  const iconCircleStyle = useMemo(() => ([
    styles.iconCircle,
    {
      backgroundColor: selected ? palette.bgColor : '#F3F4F6',
      transform: [{ rotate: wiggleRotate }],
    },
  ]), [selected, palette.bgColor, wiggleRotate]);

  const shimmerStyle = useMemo(() => ([
    StyleSheet.absoluteFill,
    { transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }] },
  ]), [shimmerTranslateX]);

  return (
    <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
      <TouchableOpacity
        style={[styles.card, selected && styles.cardSelected]}
        onPress={handlePress}
        activeOpacity={0.7}
      >
        {selected && (
          <Animated.View pointerEvents="none" style={shimmerStyle}>
            <LinearGradient
              colors={SHIMMER_GRADIENT_COLORS}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        )}

        <View style={styles.cardMain}>
          <Animated.View style={iconCircleStyle}>
            {categoryImageUrl ? (
              <Image
                source={{ uri: categoryImageUrl }}
                style={styles.vehicleImage}
                contentFit="contain"
                transition={200}
              />
            ) : (
              <View style={styles.vehiclePlaceholder}>
                <Car size={28} color={selected ? palette.color : colors.textSecondary} />
              </View>
            )}
          </Animated.View>


          <View style={[styles.verticalDivider, selected && styles.verticalDividerSelected]} />



          <View style={styles.info}>
            <View style={styles.nameRow}>
              <Text 
                style={styles.label} 
                numberOfLines={1} 
                adjustsFontSizeToFit={true}
                minimumFontScale={0.7}
              >
                {label}
              </Text>
              {selected && arrivalEta != null && (
                <View style={styles.etaBadge}>
                  <Text style={styles.etaText}>{arrivalEta} min</Text>
                </View>
              )}

            </View>
                <Text style={styles.description} numberOfLines={1}>
                  {desc?.substring(0, 12)}
                </Text>
                {selected && (
                  <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                      <Car size={10} color={colors.textSecondary} />
                      <Text style={styles.meta}>{category.per_km_rate} ETB/km</Text>
                    </View>
                  </View>
                )}


          </View>

          <View style={styles.right}>
            {fareLoading ? (
              <View style={styles.priceLoading}>
                <View style={styles.priceSkeleton} />
              </View>
            ) : (
              !selected && (
                <View style={styles.priceContainer}>
                  <Text style={styles.priceValue}>
                    {fare != null ? (
                      <>
                        ~ {fare.toFixed(0)}
                        <Text style={styles.currencyLabel}> ETB</Text>
                      </>
                    ) : (
                      <Text style={styles.currencyLabel}>Price pending</Text>
                    )}
                  </Text>
                </View>
              )

            )}

          </View>
        </View>

        {/* Selected State: Info Icon at bottom right */}
        {selected && (
          <View style={styles.bottomActions}>
            <TouchableOpacity 
              onPress={() => setShowBreakdownModal(true)}
              style={styles.infoIconWrap}
            >
              <Info size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Price Breakdown Modal */}
        <Modal
          visible={showBreakdownModal}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setShowBreakdownModal(false)}
        >
          <Pressable 
            style={styles.modalOverlay} 
            onPress={() => setShowBreakdownModal(false)}
          >
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{label} - Fare Details</Text>
              
              <View style={styles.modalBreakdown}>
                {serverBreakdown ? (
                  <>
                    <View style={styles.breakdownRowItem}>
                      <Text style={styles.breakdownLabel}>Base Fare</Text>
                      <Text style={styles.breakdownValue}>ETB {(serverBreakdown.baseFare || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRowItem}>
                      <Text style={styles.breakdownLabel}>Distance ({distanceKm.toFixed(1)} km)</Text>
                      <Text style={styles.breakdownValue}>ETB {(serverBreakdown.distanceFare || 0).toFixed(2)}</Text>
                    </View>
                    <View style={styles.breakdownRowItem}>
                      <Text style={styles.breakdownLabel}>Time ({durationMin} min)</Text>
                      <Text style={styles.breakdownValue}>ETB {(serverBreakdown.timeFare || 0).toFixed(2)}</Text>
                    </View>
                    {(serverBreakdown.bufferAmount || 0) > 0 && (
                      <View style={styles.breakdownRowItem}>
                        <Text style={styles.breakdownLabel}>Traffic Buffer</Text>
                        <Text style={styles.breakdownValue}>ETB {(serverBreakdown.bufferAmount || 0).toFixed(2)}</Text>
                      </View>
                    )}
                  </>
                ) : fare != null ? (
                  <View style={styles.breakdownRowItem}>
                    <Text style={styles.breakdownLabel}>Estimated Fare</Text>
                    <Text style={styles.breakdownValue}>ETB {fare.toFixed(2)}</Text>
                  </View>
                ) : (
                  <View style={styles.breakdownRowItem}>
                    <Text style={styles.breakdownLabel}>Pricing</Text>
                    <Text style={styles.breakdownValue}>Awaiting system estimate...</Text>
                  </View>
                )}
                
                <View style={styles.modalDivider} />
                
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total Fare</Text>
                  <Text style={styles.totalValue}>{fare != null ? `ETB ${fare.toFixed(2)}` : '--'}</Text>
                </View>

                
                <Text style={styles.protectionNote}>
                  Price is protected and only adjusts for heavy traffic or route changes.
                </Text>
              </View>

              <TouchableOpacity 
                style={styles.closeBtn}
                onPress={() => setShowBreakdownModal(false)}
              >
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Modal>


      </TouchableOpacity>
    </Animated.View>
  );
}

// `onPress` is intentionally excluded: the parent re-creates an arrow closure
// on every render, but it always resolves to selectCategory(category.id) — a
// stable action. Comparing it would force every card to re-render on every
// scroll tick of the parent, defeating windowing.
function areEqual(prev, next) {
  return (
    prev.selected        === next.selected        &&
    prev.serverFare      === next.serverFare      &&
    prev.serverBreakdown === next.serverBreakdown &&
    prev.fareLoading     === next.fareLoading     &&
    prev.distanceKm      === next.distanceKm      &&
    prev.durationMin     === next.durationMin     &&
    prev.lang            === next.lang            &&
    prev.category        === next.category
  );
}

export default memo(RideTypeCard, areEqual);

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.88;

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 0,
  },

  card: {
    width: '100%',

    flexDirection: 'column',
    paddingVertical: 8, // Slightly more vertical padding for balance
    paddingHorizontal: 12,
    borderRadius: 12, // More standard radius for compact cards
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
    ...shadow.sm,
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8, // Reduced gap to give more room to text
  },
  cardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.primaryLight,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 0,
    overflow: 'hidden', // Ensures the image stays circular
  },
  vehicleImage: {
    width: '100%',
    height: '100%',
    transform: [{ scale: 1.15 }], // Slight zoom for professional look
  },
  vehiclePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },

  categoryImage: {
    width: 130,
    height: 70,
  },
  info: {
    flex: 1,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 15, // Reduced from 17
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.1,
  },
  badge: {
    borderRadius: borderRadius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: fontWeight.semibold,
    color: colors.white,
    letterSpacing: 0.3,
  },
  description: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 0,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  priceValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#000000',
    textAlign: 'right',
  },
  currencyLabel: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  priceLoading: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    height: 28,
  },
  priceSkeleton: {
    width: 64,
    height: 18,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 50,
    marginTop: 2,
  },
  protectionText: {
    fontSize: 9,
    color: '#00674F',
    fontWeight: '700',
  },
  protectionSub: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '300',
  },
  explanationWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.03)',
    marginTop: 4,
    paddingTop: 4,
    paddingLeft: 50,
  },
  explanationText: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '300',
    letterSpacing: 0.2,
  },
  breakdownWrap: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    marginTop: 6,
    paddingTop: 6,
    paddingLeft: 50,
    gap: 2,
  },
  breakdownRow: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '400',
  },
  breakdownTotal: {
    fontSize: 11,
    color: '#00674F',
    fontWeight: '700',
    marginTop: 3,
  },
  etaBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  etaText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  verticalDivider: {
    width: 2,
    alignSelf: 'stretch',
    backgroundColor: '#EF4444',
    marginHorizontal: 12,
    marginVertical: -8,
  },
  verticalDividerSelected: {
    width: 5,
    backgroundColor: colors.primary,
  },
  bottomActions: {
    position: 'absolute',
    right: 8,
    bottom: 6,
    zIndex: 10,
  },

  infoIconWrap: {
    padding: 8,
    marginRight: -8,
    marginBottom: -4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: 24,
    ...shadow.lg,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 20,
    textAlign: 'center',
  },
  modalBreakdown: {
    gap: 12,
  },
  breakdownRowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  breakdownLabel: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  breakdownValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  modalDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  totalLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  totalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  protectionNote: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  closeBtn: {
    marginTop: 24,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeBtnText: {
    color: colors.white,
    fontWeight: fontWeight.bold,
    fontSize: fontSize.md,
  },
});
