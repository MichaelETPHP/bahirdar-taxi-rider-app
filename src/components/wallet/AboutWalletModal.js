import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X, Wallet, RefreshCw, Car, ArrowDownToLine } from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';

// Plain-language explanation for riders — no payment jargon (no "PaymentIntent",
// "gateway", "FX rate"), matching this app's simple-English tone everywhere else.
const POINTS = [
  {
    icon: Wallet,
    title: 'Pay without cash',
    body: 'Your wallet holds ETB you can spend on rides — no cash needed when you get in the car.',
  },
  {
    icon: RefreshCw,
    title: 'Top up from anywhere',
    body: 'Add money in USD from anywhere in the world. We convert it to ETB right away, so family and friends abroad can top up for you.',
  },
  {
    icon: Car,
    title: 'Rides pay automatically',
    body: 'When your ride ends, the fare comes straight out of your wallet — nothing else to do.',
  },
  {
    icon: ArrowDownToLine,
    title: 'Change your mind? Withdraw it',
    body: 'You can send money back to your card at any time — as long as it was added within the last 6 months.',
  },
];

// Same bottom-sheet chrome as TransactionHistorySheet (handle, header, close
// button) — keeping both wallet sheets visually identical is what makes the
// screen feel like one cohesive place, not two different UI patterns stapled together.
export default function AboutWalletModal({ visible, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.title}>About Wallet</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>

          {POINTS.map(({ icon: Icon, title, body }) => (
            <View key={title} style={styles.point}>
              <View style={styles.iconWrap}>
                <Icon size={18} color={colors.textPrimary} strokeWidth={2} />
              </View>
              <View style={styles.pointText}>
                <Text style={styles.pointTitle}>{title}</Text>
                <Text style={styles.pointBody}>{body}</Text>
              </View>
            </View>
          ))}
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
    paddingBottom: 32,
    paddingTop: 10,
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
    marginBottom: 18,
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
  point: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: {
    flex: 1,
    paddingTop: 2,
  },
  pointTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 3,
  },
  pointBody: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    lineHeight: 19,
  },
});
