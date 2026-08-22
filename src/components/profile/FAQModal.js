import React, { useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  Animated,
  Easing,
} from 'react-native';
import { X, ChevronDown } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const EXPAND_ANIM = LayoutAnimation.create(220, LayoutAnimation.Types.easeOut, LayoutAnimation.Properties.opacity);

const FAQ_ITEMS = [
  {
    q: 'How do I book a ride?',
    a: 'Enter your pickup and drop-off locations, choose a vehicle type, and confirm. A nearby driver is matched to you right away.',
  },
  {
    q: 'What payment methods can I use?',
    a: 'You can pay with your in-app wallet or cash directly to the driver. Wallet payments happen automatically when your trip ends — no cash needed.',
  },
  {
    q: 'How is my fare calculated?',
    a: 'Your fare is based on the distance and time of your trip. You always see the price before you confirm, so there are no surprises.',
  },
  {
    q: 'Can I cancel a ride?',
    a: 'Yes, you can cancel anytime before your trip starts. If a driver is already on the way, a small cancellation fee may apply.',
  },
  {
    q: 'How do I reach support?',
    a: "Go to Support → Contact Us to call or email our team directly. We're happy to help.",
  },
];

// Rotates its own chevron based on the `expanded` prop — kept per-row so each
// arrow animates independently instead of one shared, harder-to-reason-about
// Animated.Value juggled by index.
function FAQRow({ item, expanded, onToggle, isLast }) {
  const rotation = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(rotation, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [expanded, rotation]);

  const rotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <Pressable
        style={({ pressed }) => [styles.questionRow, pressed && styles.questionRowPressed]}
        onPress={onToggle}
      >
        <Text style={styles.question}>{item.q}</Text>
        <Animated.View style={{ transform: [{ rotate }] }}>
          <ChevronDown size={18} color={colors.textSecondary} strokeWidth={2.25} />
        </Animated.View>
      </Pressable>
      {expanded && <Text style={styles.answer}>{item.a}</Text>}
    </View>
  );
}

// Same bottom-sheet chrome as ContactUsModal/AboutWalletModal — one popup
// language across the whole Support screen instead of three different ones.
export default function FAQModal({ visible, onClose }) {
  const [expandedIndex, setExpandedIndex] = useState(null);

  const toggle = (index) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    LayoutAnimation.configureNext(EXPAND_ANIM);
    setExpandedIndex((current) => (current === index ? null : index));
  };

  const handleClose = () => {
    setExpandedIndex(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>FAQ</Text>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.closeBtn}>
              <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>

          <Text style={styles.subtitle}>Quick answers to common questions.</Text>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false} style={styles.list}>
            {FAQ_ITEMS.map((item, index) => (
              <FAQRow
                key={item.q}
                item={item}
                expanded={expandedIndex === index}
                onToggle={() => toggle(index)}
                isLast={index === FAQ_ITEMS.length - 1}
              />
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '80%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: {
    fontSize: fontSize['2xl'],
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  list: {
    marginBottom: 12,
  },
  row: {
    paddingVertical: 4,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderRadius: 12,
  },
  questionRowPressed: {
    backgroundColor: colors.backgroundAlt,
  },
  question: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  answer: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingBottom: 16,
    paddingRight: 30,
  },
});
