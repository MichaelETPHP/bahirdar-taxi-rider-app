import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Linking,
  Animated,
  Platform,
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import KeyboardAwareModal from '../../components/ui/KeyboardAwareModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Avatar from '../../components/common/Avatar';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { updateProfile } from '../../services/authService';
import { API_BASE_URL } from '../../config/api';

const { width: SW } = Dimensions.get('window');
const PAD = SW < 375 ? 14 : 16;
const SILVER = '#9CA3AF';

const SECTION1_ITEMS = [
  { key: 'language',         icon: 'globe',         screen: 'Language',         color: SILVER },
  { key: 'notification',     icon: 'bell',           screen: 'Notification',     color: SILVER },
  { key: 'emergencyContact', icon: 'phone-alt',      screen: 'EmergencyContact', color: SILVER },
  { key: 'savedPlace',       icon: 'map-marker-alt', screen: 'SavedPlace',       color: SILVER },
];

const SECTION2_ITEMS = [
  { key: 'rateApp',        icon: 'star',       action: 'rate',    color: '#F59E0B' },
  { key: 'privacyPolicy',  icon: 'shield-alt', action: 'privacy', color: '#6366F1' },
  { key: 'termsCondition', icon: 'file-alt',   action: 'terms',   color: colors.primary },
];

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male',   icon: 'mars'  },
  { value: 'female', label: 'Female', icon: 'venus' },
];

// Strip time portion — handles both "YYYY-MM-DD" and "YYYY-MM-DDTHH:mm:ss.sssZ"
function toDateParts(isoDate) {
  const datePart = (isoDate || '').split('T')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  return { y, m, d };
}

function formatDateDisplay(isoDate) {
  if (!isoDate) return '';
  const { y, m, d } = toDateParts(isoDate);
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${String(d).padStart(2,'0')} ${months[m-1]} ${y}`;
}

function isoToDate(isoDate) {
  if (!isoDate) return new Date(2000, 0, 1);
  const { y, m, d } = toDateParts(isoDate);
  if (!y || !m || !d || isNaN(y) || isNaN(m) || isNaN(d)) return new Date(2000, 0, 1);
  return new Date(y, m - 1, d);
}

function dateToIso(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, phone, token, updateUser, logout, deleteAccount } = useAuthStore();

  // Accordion
  const [accordionOpen, setAccordionOpen] = useState(false);
  const accordionAnim = useRef(new Animated.Value(0)).current;

  // Edit fields
  const [name, setName]               = useState(user?.fullName || '');
  const [email, setEmail]             = useState(user?.email || '');
  const [gender, setGender]           = useState(user?.gender || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || user?.date_of_birth || '');
  const [saving, setSaving]           = useState(false);

  // Date picker — modal approach, no Done button
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate, setPickerDate]         = useState(isoToDate(dateOfBirth));

  // Avatar
  const [avatarUri, setAvatarUri]             = useState(user?.avatarUrl || user?.avatar_url || null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Delete modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteReason, setDeleteReason]             = useState('');

  // Pull-to-refresh
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/users/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.data) {
        const u = data.data;
        updateUser({
          fullName:    u.full_name   || u.fullName,
          email:       u.email,
          gender:      u.gender,
          dateOfBirth: u.date_of_birth,
          avatarUrl:   u.avatar_url,
        });
        setName(u.full_name || u.fullName || '');
        setEmail(u.email || '');
        setGender(u.gender || '');
        setDateOfBirth(u.date_of_birth || '');
        setPickerDate(isoToDate(u.date_of_birth || ''));
        setAvatarUri(u.avatar_url || null);
      }
    } catch (_) {}
    setRefreshing(false);
  }, [token]);

  // Toast
  const toastAnim  = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastTimer = useRef(null);

  const showToast = (message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7 }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, { toValue: 0, duration: 260, useNativeDriver: true }).start();
    }, 3000);
  };

  // Verified badge pulse
  const shineAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (user?.isVerified === false) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.timing(shineAnim, { toValue: 1.18, duration: 900, useNativeDriver: true }),
        Animated.timing(shineAnim, { toValue: 0.88, duration: 900, useNativeDriver: true }),
      ]).start(() => run());
    };
    run();
    return () => { cancelled = true; shineAnim.stopAnimation(); };
  }, [user?.isVerified]);

  const toggleAccordion = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !accordionOpen;
    setAccordionOpen(next);
    Animated.spring(accordionAnim, { toValue: next ? 1 : 0, useNativeDriver: false, speed: 18, bounciness: 2 }).start();
  };

  // Avatar capture
  const handleAvatarPress = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showToast('Camera permission is required.', 'error');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];

    // Compress to JPEG, max 900px, quality 0.75 — keeps upload under ~500 KB
    const compressed = await ImageManipulator.manipulateAsync(
      asset.uri,
      [{ resize: { width: 900 } }],
      { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
    );

    const form = new FormData();
    form.append('avatar', { uri: compressed.uri, name: 'avatar.jpg', type: 'image/jpeg' });

    setUploadingAvatar(true);
    try {
      const res  = await fetch(`${API_BASE_URL}/users/me/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Upload failed');
      const url = data?.data?.avatar_url;
      setAvatarUri(url);
      updateUser({ avatarUrl: url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Profile photo updated!', 'success');
    } catch (err) {
      showToast(err?.message || 'Could not upload photo.', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Save profile
  const handleSaveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) { showToast('Please enter your full name.', 'error'); return; }
    setSaving(true);
    try {
      const payload = { fullName: trimmedName };
      if (email.trim()) payload.email = email.trim().toLowerCase();
      if (gender)       payload.gender = gender;
      if (dateOfBirth)  payload.dateOfBirth = dateOfBirth;
      const res     = await updateProfile(payload, token);
      const updated = res?.data || res;
      updateUser({
        fullName:    updated.full_name    ?? trimmedName,
        email:       updated.email        ?? email,
        gender:      updated.gender       ?? gender,
        dateOfBirth: updated.date_of_birth ?? dateOfBirth,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Profile updated successfully!', 'success');
      setAccordionOpen(false);
      Animated.spring(accordionAnim, { toValue: 0, useNativeDriver: false, speed: 18, bounciness: 2 }).start();
    } catch (err) {
      showToast(err?.message || 'Failed to save. Try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Date picker handlers
  const handleDateChange = (event, selectedDate) => {
    if (!selectedDate) return;
    setPickerDate(selectedDate);
    setDateOfBirth(dateToIso(selectedDate));
    // Android auto-closes; iOS we close on confirm via modal backdrop
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  const handleSection2Action = (action) => {
    if (action === 'rate')    Linking.openURL('https://play.google.com/store/apps');
    if (action === 'privacy') Linking.openURL('https://example.com/privacy');
    if (action === 'terms')   Linking.openURL('https://example.com/terms');
  };

  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('drawer.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const accordionMaxHeight = accordionAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 800] });
  const chevronRotation    = accordionAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>

      {/* ── Fixed header (never scrolls) ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
          activeOpacity={0.7}
        >
          <FontAwesome5 name="arrow-left" size={14} color={colors.textPrimary} solid />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.title')}</Text>
      </View>

      {/* ── Sticky avatar card (never scrolls) ── */}
      <View style={styles.avatarCard}>
        <TouchableOpacity onPress={handleAvatarPress} activeOpacity={0.8} disabled={uploadingAvatar}>
          <View style={styles.avatarWithBadge}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <Avatar initials={user?.fullName?.slice(0, 2)?.toUpperCase() || '?'} size={64} />
            )}
            <View style={styles.cameraBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size={9} color={colors.white} />
                : <FontAwesome5 name="camera" size={9} color={colors.white} solid />}
            </View>
            {(user?.isVerified !== false) && (
              <Animated.View style={[styles.verifiedBadge, { transform: [{ scale: shineAnim }] }]}>
                <FontAwesome5 name="check-circle" size={16} color={colors.verified} solid />
              </Animated.View>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.avatarInfo}>
          <Text style={styles.profileName} numberOfLines={1}>
            {user?.fullName || t('profile.title')}
          </Text>
          <Text style={styles.profilePhone}>
            {phone ? `+251 ${phone.slice(1)}` : '—'}
          </Text>
          <TouchableOpacity onPress={handleAvatarPress} disabled={uploadingAvatar} activeOpacity={0.7}>
            <Text style={styles.changePhotoText}>
              {uploadingAvatar ? 'Uploading…' : 'Change photo'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Scrollable content with pull-to-refresh ── */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Edit Profile Accordion */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.accordionHeader} onPress={toggleAccordion} activeOpacity={0.8}>
            <View style={styles.accordionHeaderLeft}>
              <View style={[styles.iconBox, { backgroundColor: `${colors.primary}18` }]}>
                <FontAwesome5 name="user-edit" size={12} color={colors.primary} solid />
              </View>
              <Text style={styles.accordionTitle}>Edit Profile</Text>
            </View>
            <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
              <FontAwesome5 name="chevron-down" size={11} color={colors.textSecondary} solid />
            </Animated.View>
          </TouchableOpacity>

          <Animated.View style={{ maxHeight: accordionMaxHeight, overflow: 'hidden' }}>
            <View style={styles.accordionContent}>
              <View style={styles.hairline} />

              {/* Full Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <View style={styles.inputRow}>
                  <FontAwesome5 name="user" size={11} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    value={name}
                    onChangeText={setName}
                    placeholder="Your full name"
                    placeholderTextColor={colors.inputPlaceholder}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              {/* Email */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <View style={styles.inputRow}>
                  <FontAwesome5 name="envelope" size={11} color={colors.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.fieldInput}
                    value={email}
                    onChangeText={setEmail}
                    placeholder="your@email.com"
                    placeholderTextColor={colors.inputPlaceholder}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Gender */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Gender</Text>
                <View style={styles.genderRow}>
                  {GENDER_OPTIONS.map((opt) => {
                    const active = gender === opt.value;
                    return (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.genderChip, active && styles.genderChipActive]}
                        onPress={() => setGender(opt.value)}
                        activeOpacity={0.75}
                      >
                        <FontAwesome5
                          name={opt.icon}
                          size={12}
                          color={active ? colors.white : colors.textSecondary}
                          solid
                          style={{ marginRight: 6 }}
                        />
                        <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Date of Birth */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Date of Birth</Text>
                <TouchableOpacity
                  style={styles.inputRow}
                  onPress={() => setShowDatePicker(true)}
                  activeOpacity={0.8}
                >
                  <FontAwesome5 name="calendar-alt" size={11} color={colors.textSecondary} style={styles.inputIcon} />
                  <Text style={[styles.fieldInput, !dateOfBirth && { color: colors.inputPlaceholder }]}>
                    {dateOfBirth ? formatDateDisplay(dateOfBirth) : 'DD MMM YYYY'}
                  </Text>
                  <FontAwesome5 name="chevron-down" size={10} color={colors.textSecondary} style={{ marginRight: 2 }} />
                </TouchableOpacity>
              </View>

              {/* Save */}
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                activeOpacity={0.85}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <>
                    <FontAwesome5 name="check" size={12} color={colors.white} solid style={{ marginRight: 7 }} />
                    <Text style={styles.saveBtnText}>Save Changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>

        {/* Section 1 */}
        <View style={styles.card}>
          {SECTION1_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.listRow, idx === SECTION1_ITEMS.length - 1 && styles.listRowLast]}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: `${item.color}18` }]}>
                <FontAwesome5 name={item.icon} size={12} color={item.color} solid />
              </View>
              <Text style={styles.listLabel}>{t(`profile.${item.key}`)}</Text>
              <FontAwesome5 name="chevron-right" size={10} color={colors.border} solid />
            </TouchableOpacity>
          ))}
        </View>

        {/* Section 2 */}
        <View style={styles.card}>
          {SECTION2_ITEMS.map((item, idx) => (
            <TouchableOpacity
              key={item.key}
              style={[styles.listRow, idx === SECTION2_ITEMS.length - 1 && styles.listRowLast]}
              onPress={() => handleSection2Action(item.action)}
              activeOpacity={0.7}
            >
              <View style={[styles.iconBox, { backgroundColor: `${item.color}18` }]}>
                <FontAwesome5 name={item.icon} size={12} color={item.color} solid />
              </View>
              <Text style={styles.listLabel}>{t(`profile.${item.key}`)}</Text>
              <FontAwesome5 name="chevron-right" size={10} color={colors.border} solid />
            </TouchableOpacity>
          ))}
        </View>

        {/* Section 3: Logout / Delete */}
        <View style={styles.card}>
          <TouchableOpacity style={styles.listRow} onPress={handleLogout} activeOpacity={0.7}>
            <View style={[styles.iconBox, { backgroundColor: '#6B728018' }]}>
              <FontAwesome5 name="sign-out-alt" size={12} color={SILVER} solid />
            </View>
            <Text style={styles.listLabel}>{t('profile.logout')}</Text>
            <FontAwesome5 name="chevron-right" size={10} color={colors.border} solid />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.listRow, styles.listRowLast]}
            onPress={() => { setDeleteReason(''); setDeleteModalVisible(true); }}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: `${colors.error}18` }]}>
              <FontAwesome5 name="trash-alt" size={12} color={colors.error} solid />
            </View>
            <Text style={[styles.listLabel, { color: colors.error }]}>{t('profile.deleteAccount')}</Text>
            <FontAwesome5 name="chevron-right" size={10} color={colors.error} solid />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── Date picker — iOS modal, tap backdrop to confirm ── */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowDatePicker(false)}
        >
          <TouchableOpacity
            style={styles.dateModalBackdrop}
            activeOpacity={1}
            onPress={() => setShowDatePicker(false)}
          >
            <View style={styles.dateModalSheet} onStartShouldSetResponder={() => true}>
              <View style={styles.dateModalHandle} />
              <Text style={styles.dateModalTitle}>Date of Birth</Text>
              <DateTimePicker
                value={pickerDate}
                mode="date"
                display="spinner"
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
                onChange={handleDateChange}
                textColor={colors.textPrimary}
                style={{ width: '100%' }}
              />
              <TouchableOpacity
                style={styles.dateModalConfirm}
                onPress={() => setShowDatePicker(false)}
                activeOpacity={0.85}
              >
                <Text style={styles.dateModalConfirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Android — native dialog auto-closes */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display="default"
          maximumDate={new Date()}
          minimumDate={new Date(1920, 0, 1)}
          onChange={handleDateChange}
        />
      )}

      {/* ── Animated Toast ── */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.toast,
          toast.type === 'error' ? styles.toastError : styles.toastSuccess,
          {
            opacity: toastAnim,
            transform: [
              { translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-14, 0] }) },
              { scale:      toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        <FontAwesome5
          name={toast.type === 'error' ? 'exclamation-circle' : 'check-circle'}
          size={14} color={colors.white} solid
          style={{ marginRight: 9 }}
        />
        <Text style={styles.toastText}>{toast.message}</Text>
      </Animated.View>

      {/* ── Delete Account Modal ── */}
      <KeyboardAwareModal
        visible={deleteModalVisible}
        onRequestClose={() => setDeleteModalVisible(false)}
        contentContainerStyle={styles.modalContent}
      >
        <Text style={styles.modalTitle}>{t('profile.deleteAccount')}</Text>
        <Text style={styles.modalSubtitle}>{t('profile.deleteReasonAsk')}</Text>
        <TextInput
          style={styles.reasonInput}
          placeholder={t('profile.deleteReasonPlaceholder')}
          placeholderTextColor={colors.inputPlaceholder}
          value={deleteReason}
          onChangeText={setDeleteReason}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
        />
        <View style={styles.modalButtons}>
          <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setDeleteModalVisible(false)}>
            <Text style={styles.modalBtnCancelText}>{t('common.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.modalBtnDelete}
            onPress={() => { setDeleteModalVisible(false); deleteAccount(); }}
          >
            <Text style={styles.modalBtnDeleteText}>{t('profile.deleteAccount')}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.backgroundAlt },

  // ── Fixed header (outside ScrollView)
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingTop: 8,
    paddingBottom: 10,
    gap: 10,
    backgroundColor: colors.backgroundAlt,
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
  },
  title: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.textPrimary },

  // ── Sticky avatar card (outside ScrollView)
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: PAD,
    borderRadius: borderRadius.lg,
    paddingVertical: 14,
    paddingHorizontal: PAD,
    marginBottom: 10,
    gap: 14,
    ...shadow.sm,
  },
  avatarWithBadge: { position: 'relative' },
  avatarImage: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.border },
  cameraBadge: {
    position: 'absolute', bottom: 0, left: 0,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: colors.white,
  },
  verifiedBadge: {
    position: 'absolute', bottom: -1, right: -1,
    backgroundColor: colors.white,
    borderRadius: 10, padding: 1,
  },
  avatarInfo: { flex: 1 },
  profileName: {
    fontSize: fontSize.md, fontWeight: fontWeight.bold,
    color: colors.textPrimary, marginBottom: 2,
  },
  profilePhone: { fontSize: fontSize.xs, color: colors.textSecondary, marginBottom: 4 },
  changePhotoText: { fontSize: fontSize.xs, color: colors.primary, fontWeight: fontWeight.semibold },

  // ── ScrollView content
  scroll: { paddingHorizontal: PAD, paddingBottom: 36 },

  // Shared card
  card: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: 10,
    ...shadow.sm,
  },

  // Accordion header
  accordionHeader: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: PAD,
  },
  accordionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accordionTitle: { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  accordionContent: { paddingHorizontal: PAD, paddingBottom: 16 },
  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 14 },

  iconBox: { width: 28, height: 28, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },

  // Form
  fieldGroup: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 10, fontWeight: fontWeight.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.9,
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundAlt,
    paddingHorizontal: 12, height: 42,
  },
  inputRowDisabled: { backgroundColor: '#F3F4F6', opacity: 0.65 },
  inputIcon: { marginRight: 8 },
  fieldInput: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, paddingVertical: 0 },

  // Gender
  genderRow: { flexDirection: 'row', gap: 8 },
  genderChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.backgroundAlt,
  },
  genderChipActive:     { borderColor: colors.primary, backgroundColor: colors.primary },
  genderChipText:       { fontSize: fontSize.sm, color: colors.textSecondary, fontWeight: fontWeight.semibold },
  genderChipTextActive: { color: colors.white },

  // Save button
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.primary, borderRadius: borderRadius.md,
    height: 42, marginTop: 4,
  },
  saveBtnText: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, color: colors.white },

  // List rows
  listRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: PAD,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    gap: 12,
  },
  listRowLast: { borderBottomWidth: 0 },
  listLabel: { flex: 1, fontSize: fontSize.base, color: colors.textPrimary, fontWeight: fontWeight.medium },

  // Date picker — iOS bottom sheet modal
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dateModalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: PAD,
    paddingBottom: 32,
    paddingTop: 12,
    alignItems: 'center',
  },
  dateModalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 14,
  },
  dateModalTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
    marginBottom: 4,
    alignSelf: 'flex-start',
  },
  dateModalConfirm: {
    width: '100%',
    height: 46,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  dateModalConfirmText: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.white },

  // Toast
  toast: {
    position: 'absolute',
    top: 68,
    left: PAD, right: PAD,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: borderRadius.lg,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12,
    elevation: 10,
  },
  toastSuccess: { backgroundColor: colors.primary },
  toastError:   { backgroundColor: colors.error },
  toastText: {
    flex: 1, fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.white, lineHeight: 18,
  },

  // Delete modal
  modalContent: {
    width: '100%', maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg, padding: 22,
  },
  modalTitle: { fontSize: fontSize.md, fontWeight: fontWeight.bold, color: colors.textPrimary, marginBottom: 6 },
  modalSubtitle: { fontSize: fontSize.sm, color: colors.textSecondary, marginBottom: 14 },
  reasonInput: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: fontSize.sm, color: colors.textPrimary,
    minHeight: 72, marginBottom: 18,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: {
    flex: 1, height: 42, borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnCancelText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.textPrimary },
  modalBtnDelete: {
    flex: 1, height: 42, borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnDeleteText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: colors.white },
});
