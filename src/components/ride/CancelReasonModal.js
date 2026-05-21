import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  ActivityIndicator, Pressable, Platform,
} from 'react-native';
import { X, AlertCircle } from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';

const FALLBACK_REASONS = [
  { id: 1, label: 'Driver is taking too long' },
  { id: 2, label: 'Changed my mind' },
  { id: 3, label: 'Wrong pickup location' },
  { id: 4, label: 'Found another ride' },
];

export default function CancelReasonModal({
  visible,
  onClose,
  onConfirm,   // (reason: { id, label }) => void
  fetchReasons, // () => Promise<{ data: [{ id, label }] }>
  loading = false,
}) {
  const [reasons, setReasons]     = useState(FALLBACK_REASONS);
  const [selected, setSelected]   = useState(null);
  const [fetching, setFetching]   = useState(false);

  useEffect(() => {
    if (!visible) { setSelected(null); return; }
    if (!fetchReasons) return;

    setFetching(true);
    fetchReasons()
      .then((res) => {
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (rows.length > 0) setReasons(rows);
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setFetching(false));
  }, [visible]);

  const handleConfirm = useCallback(() => {
    if (!selected) return;
    onConfirm(selected);
  }, [selected, onConfirm]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={e => e.stopPropagation()}>

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <AlertCircle size={18} color={colors.error} />
              <Text style={styles.title}>Cancel Trip</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>Why are you cancelling?</Text>

          {/* Reason list */}
          {fetching ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: 28 }} />
          ) : (
            <View style={styles.reasonList}>
              {reasons.map((r) => {
                const active = selected?.id === r.id;
                return (
                  <TouchableOpacity
                    key={r.id}
                    style={[styles.reasonRow, active && styles.reasonRowActive]}
                    onPress={() => setSelected(r)}
                    activeOpacity={0.75}
                  >
                    {/* Radio button */}
                    <View style={[styles.radio, active && styles.radioActive]}>
                      {active && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.reasonLabel, active && styles.reasonLabelActive]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.btnBack} onPress={onClose} activeOpacity={0.8}>
              <Text style={styles.btnBackText}>Go Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btnConfirm, (!selected || loading) && styles.btnDisabled]}
              onPress={handleConfirm}
              disabled={!selected || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator size="small" color={colors.white} />
                : <Text style={styles.btnConfirmText}>Cancel Trip</Text>}
            </TouchableOpacity>
          </View>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.52)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...shadow.md,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center',
    alignItems: 'center',
  },

  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginBottom: 16,
  },

  reasonList: {
    gap: 10,
    marginBottom: 24,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  reasonRowActive: {
    borderColor: colors.error,
    backgroundColor: '#FEF2F2',
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioActive: {
    borderColor: colors.error,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.error,
  },

  reasonLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  reasonLabelActive: {
    color: colors.error,
    fontWeight: fontWeight.semibold,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  btnBack: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnBackText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
  },
  btnConfirm: {
    flex: 1,
    height: 48,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadow.sm,
  },
  btnConfirmText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  btnDisabled: {
    opacity: 0.45,
  },
});
