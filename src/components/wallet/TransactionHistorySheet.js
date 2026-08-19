import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { X, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';

import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { fetchWalletTransactions } from '../../services/walletService';
import useAuthStore from '../../store/authStore';
import { listenForWalletUpdate, removeWalletUpdateListener } from '../../services/socketService';

const TYPE_LABELS = {
  trip_charge: 'Trip payment',
  wallet_topup: 'Wallet top-up',
  refund: 'Withdrawal',
  bonus: 'Bonus',
  adjustment: 'Adjustment',
};

export function formatType(type) {
  if (TYPE_LABELS[type]) return TYPE_LABELS[type];
  return String(type || 'Transaction')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

// Exported — WalletScreen reuses this for its on-card recent-activity
// preview, so a transaction looks identical whether seen there or in the
// full history sheet.
export function TransactionRow({ item }) {
  const amount = parseFloat(item.amount_etb) || 0;
  const isCredit = amount >= 0;
  return (
    <View style={styles.row}>
      <View style={[styles.iconWrap, isCredit ? styles.iconWrapCredit : styles.iconWrapDebit]}>
        {isCredit
          ? <ArrowDownLeft size={16} color={colors.success} strokeWidth={2.25} />
          : <ArrowUpRight size={16} color={colors.errorLight} strokeWidth={2.25} />}
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{formatType(item.type)}</Text>
        <Text style={styles.rowDate}>{formatDate(item.created_at)}</Text>
      </View>
      <Text style={[styles.rowAmount, isCredit ? styles.rowAmountCredit : styles.rowAmountDebit]}>
        {isCredit ? '+' : '−'}{Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: 2 })} ETB
      </Text>
    </View>
  );
}

export default function TransactionHistorySheet({ visible, onClose }) {
  const token = useAuthStore((s) => s.token);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWalletTransactions(token, { limit: 200 });
      setTransactions(Array.isArray(res?.data) ? res.data : []);
    } catch (_) {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  // Live-prepend while the sheet is open — only bother wiring this up when
  // it's actually visible, since a background listener would just be doing
  // pointless work for a list nobody can see.
  useEffect(() => {
    if (!visible) return;
    const onWalletUpdate = (data) => {
      if (!data?.transaction) return;
      setTransactions((prev) => {
        if (prev.some((t) => t.id === data.transaction.id)) return prev;
        return [data.transaction, ...prev];
      });
    };
    listenForWalletUpdate(onWalletUpdate);
    return () => removeWalletUpdateListener(onWalletUpdate);
  }, [visible]);

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
            <Text style={styles.title}>Transaction Details</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={16} color={colors.textSecondary} strokeWidth={2.25} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.stateWrap}>
              <ActivityIndicator color={colors.textPrimary} />
            </View>
          ) : transactions.length === 0 ? (
            <View style={styles.stateWrap}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <TransactionRow item={item} />}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const SHEET_MAX_HEIGHT = '72%';

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: SHEET_MAX_HEIGHT,
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 24,
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
    marginBottom: 8,
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
  stateWrap: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
  },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapCredit: {
    backgroundColor: 'rgba(16,185,129,0.12)',
  },
  iconWrapDebit: {
    backgroundColor: 'rgba(248,113,113,0.12)',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  rowDate: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rowAmount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  rowAmountCredit: {
    color: colors.success,
  },
  rowAmountDebit: {
    color: colors.errorLight,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});
