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
  Modal,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import DateTimePicker from '@react-native-community/datetimepicker';
import KeyboardAwareModal from '../../components/ui/KeyboardAwareModal';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import Avatar from '../../components/common/Avatar';
import {
  Globe, Bell, Phone, MapPin, Star, ShieldAlert, File,
  Camera, CheckCircle, UserPen, ChevronDown, Check,
  ChevronRight, LogOut, Trash2, Mail, Calendar, AlertCircle,
  X, User, Wallet, Car,
} from 'lucide-react-native';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight, fontFamilyBold, fontFamilySemiBold, fontFamilyMedium, fontFamilyRegular } from '../../constants/typography';
import { borderRadius, shadow } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { updateProfile, uploadAvatar } from '../../services/authService';
import { API_BASE_URL } from '../../config/api';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const { width: SW } = Dimensions.get('window');
const PAD   = SW < 375 ? 14 : 16;
const SILVER = '#9CA3AF';

const SECTION1_ITEMS = [
  { key: 'language',         icon: Globe,       screen: 'Language',         color: SILVER },
  { key: 'notification',     icon: Bell,         screen: 'Notification',     color: SILVER },
  { key: 'emergencyContact', icon: Phone,        screen: 'EmergencyContact', color: SILVER },
  { key: 'savedPlace',       icon: MapPin,       screen: 'SavedPlace',       color: SILVER },
];

const SECTION2_ITEMS = [
  { key: 'rateApp',        icon: Star,       action: 'rate',    color: '#F59E0B' },
  { key: 'privacyPolicy',  icon: ShieldAlert, action: 'privacy', color: '#6366F1' },
  { key: 'termsCondition', icon: File,       action: 'terms',   color: colors.primary },
];

const GENDER_OPTIONS = [
  { value: 'male',   label: 'Male' },
  { value: 'female', label: 'Female' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Date Helpers
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function ProfileScreen({ navigation }) {
  const { t } = useTranslation();
  const { user, phone, token, updateUser, logout, deleteAccount } = useAuthStore();

  // ── Edit mode
  const [editMode, setEditMode] = useState(false);

  // ── Edit fields — initialise from store
  const [name,        setName]        = useState(user?.fullName   || '');
  const [email,       setEmail]       = useState(user?.email      || '');
  const [gender,      setGender]      = useState(user?.gender     || '');
  const [dateOfBirth, setDateOfBirth] = useState(user?.dateOfBirth || user?.date_of_birth || '');
  const [saving,      setSaving]      = useState(false);

  // Re-sync fields if the store user object changes (e.g. after loadProfile)
  useEffect(() => {
    if (user?.fullName)    setName(user.fullName);
    if (user?.email)       setEmail(user.email);
    if (user?.gender)      setGender(user.gender);
    const dob = user?.dateOfBirth || user?.date_of_birth;
    if (dob) setDateOfBirth(dob);
  }, [user?.fullName, user?.email, user?.gender, user?.dateOfBirth, user?.date_of_birth]);

  // ── Date picker
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerDate,     setPickerDate]     = useState(isoToDate(dateOfBirth));

  // ── Avatar - always sync from DB, no local caching
  const dbAvatarUrl = user?.avatarUrl || user?.avatar_url;
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // ── Delete modal
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteReason,       setDeleteReason]       = useState('');


  // ── Toast
  const toastAnim  = useRef(new Animated.Value(0)).current;
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastAnim.setValue(0);
    Animated.spring(toastAnim, {
      toValue: 1, useNativeDriver: true, speed: 22, bounciness: 7,
    }).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastAnim, {
        toValue: 0, duration: 260, useNativeDriver: true,
      }).start();
    }, 3500);
  }, []);

  // ── Verified badge pulse
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

  // ── Avatar pick & upload
  const handleAvatarPress = () => {
    Alert.alert(
      t('profile.changePhoto'),
      t('profile.chooseSource'),
      [
        { text: t('profile.takePhoto'),    onPress: () => processImagePick('camera')  },
        { text: t('profile.chooseGallery'), onPress: () => processImagePick('gallery') },
        { text: t('common.cancel'), style: 'cancel' },
      ]
    );
  };

  const processImagePick = async (source) => {
    try {
      let permResult;
      if (source === 'camera') {
        permResult = await ImagePicker.requestCameraPermissionsAsync();
      } else {
        permResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      }
      if (permResult.status !== 'granted') {
        showToast('Permission required to access ' + source, 'error');
        return;
      }

      const options = {
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      };

      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const asset = result.assets[0];

      // Compress & resize to 800px max
      const compressed = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 800 } }],
        { compress: 0.75, format: ImageManipulator.SaveFormat.JPEG }
      );

      const form = new FormData();
      form.append('avatar', {
        uri:  compressed.uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      });

      setUploadingAvatar(true);
      try {
        const res = await uploadAvatar(form, token);
        const url = res?.data?.avatar_url || res?.avatarUrl;
        if (!url) throw new Error('Server did not return an avatar URL');

        // Update Zustand store with server URL (cache buster ensures fresh image from DB)
        updateUser({ avatarUrl: url });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast('Profile photo updated!', 'success');
      } catch (err) {
        console.error('[Avatar] Upload error:', err?.status, err?.message);
        const msg = err?.status === 500
          ? 'Server error — please try again later'
          : err?.message || 'Could not upload photo';
        showToast(msg, 'error');
      } finally {
        setUploadingAvatar(false);
      }
    } catch (err) {
      console.error('[Avatar] Picker error:', err);
      showToast('Could not open camera/gallery', 'error');
    }
  };

  // ── Save profile (PATCH /users/me)
  const handleSaveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Please enter your full name', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = { fullName: trimmedName };
      const trimmedEmail = email.trim().toLowerCase();
      if (trimmedEmail)  payload.email       = trimmedEmail;
      if (gender)        payload.gender      = gender;
      if (dateOfBirth)   payload.dateOfBirth = dateOfBirth;

      const res     = await updateProfile(payload, token);
      const updated = res?.data || res;

      // Update the local store with what the server returned
      updateUser({
        fullName:    updated.full_name    || updated.fullName    || trimmedName,
        email:       updated.email        || trimmedEmail,
        gender:      updated.gender       || gender,
        dateOfBirth: updated.date_of_birth || updated.dateOfBirth || dateOfBirth,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      showToast('Profile updated successfully!', 'success');

      // Collapse the accordion
      setAccordionOpen(false);
      Animated.spring(accordionAnim, {
        toValue: 0, useNativeDriver: false, speed: 18, bounciness: 2,
      }).start();
    } catch (err) {
      console.error('[Profile] Save error:', err);
      const msg = err?.message || 'Failed to save. Try again.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ── Date picker handlers
  const handleDateChange = (event, selectedDate) => {
    if (!selectedDate) return;
    setPickerDate(selectedDate);
    setDateOfBirth(dateToIso(selectedDate));
    if (Platform.OS === 'android') setShowDatePicker(false);
  };

  // ── Section 2 actions
  const handleSection2Action = (action) => {
    if (action === 'rate')    Linking.openURL('https://play.google.com/store/apps');
    if (action === 'privacy') Linking.openURL('https://example.com/privacy');
    if (action === 'terms')   Linking.openURL('https://example.com/terms');
  };

  // ── Logout
  const handleLogout = () => {
    Alert.alert(t('profile.logout'), t('profile.logoutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('drawer.logout'), style: 'destructive', onPress: () => logout() },
    ]);
  };

  const walletBalance = user?.walletBalance ?? 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Render - Single Page Professional Design
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); navigation.goBack(); }}
          activeOpacity={0.75}
        >
          <X size={16} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('profile.title')}</Text>
        <TouchableOpacity
          style={styles.settingsBtn}
          onPress={() => setShowSettingsMenu(true)}
          activeOpacity={0.75}
        >
          <View style={styles.settingsDot} />
          <View style={styles.settingsDot} />
          <View style={styles.settingsDot} />
        </TouchableOpacity>
      </View>

      {/* ── Main Content (Single Page, No Scroll) ── */}
      <View style={styles.content}>

        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          {/* Avatar Section */}
          <TouchableOpacity
            onPress={handleAvatarPress}
            disabled={uploadingAvatar}
            activeOpacity={0.85}
            style={styles.avatarCenter}
          >
            <View style={styles.avatarRing}>
              {dbAvatarUrl ? (
                <Image
                  source={{ uri: dbAvatarUrl }}
                  style={styles.avatarImg}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="none"
                />
              ) : (
                <Avatar initials={user?.fullName?.slice(0, 2)?.toUpperCase() || '?'} size={80} />
              )}
            </View>
            <View style={styles.cameraBadge}>
              {uploadingAvatar
                ? <ActivityIndicator size={12} color={colors.white} />
                : <Camera size={12} color={colors.white} />}
            </View>
            {(user?.isVerified !== false) && (
              <Animated.View style={[styles.verifiedBadge, { transform: [{ scale: shineAnim }] }]}>
                <CheckCircle size={18} color={colors.primary} />
              </Animated.View>
            )}
          </TouchableOpacity>

          {/* Name Section */}
          {editMode ? (
            <View style={styles.editForm}>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Full Name</Text>
                <TextInput
                  style={styles.inputField}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Email</Text>
                <TextInput
                  style={styles.inputField}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="your@email.com"
                  placeholderTextColor={colors.inputPlaceholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.6 }]}
                onPress={() => {
                  handleSaveProfile();
                  if (!saving) setEditMode(false);
                }}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.saveBtnText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.profileNameDisplay}>{user?.fullName || t('profile.title')}</Text>
              {phone && <Text style={styles.profileSubtitle}>{phone.replace(/^(\+251|0)/, '0')}</Text>}
              {email && <Text style={styles.profileSubtitle} numberOfLines={1}>{email}</Text>}
              <TouchableOpacity onPress={() => setEditMode(true)} activeOpacity={0.7}>
                <Text style={styles.editLink}>Edit Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Star size={14} color={colors.primary} />
            <Text style={styles.statVal}>{user?.rating || '4.8'}</Text>
            <Text style={styles.statLbl}>Rating</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Car size={14} color={colors.primary} />
            <Text style={styles.statVal}>{user?.tripCount || '0'}</Text>
            <Text style={styles.statLbl}>Trips</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Calendar size={14} color={colors.primary} />
            <Text style={styles.statVal}>2024</Text>
            <Text style={styles.statLbl}>Member</Text>
          </View>
        </View>

        {/* Settings Items */}
        <View style={styles.settingsCard}>
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Language')} activeOpacity={0.7}>
            <Globe size={16} color={colors.textSecondary} />
            <Text style={styles.settingText}>Language</Text>
            <ChevronRight size={14} color={colors.border} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('Notification')} activeOpacity={0.7}>
            <Bell size={16} color={colors.textSecondary} />
            <Text style={styles.settingText}>Notifications</Text>
            <ChevronRight size={14} color={colors.border} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.settingRow} onPress={() => navigation.navigate('EmergencyContact')} activeOpacity={0.7}>
            <Phone size={16} color={colors.textSecondary} />
            <Text style={styles.settingText}>Emergency Contact</Text>
            <ChevronRight size={14} color={colors.border} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.settingRow, styles.settingRowLast]} onPress={() => navigation.navigate('SavedPlace')} activeOpacity={0.7}>
            <MapPin size={16} color={colors.textSecondary} />
            <Text style={styles.settingText}>Saved Places</Text>
            <ChevronRight size={14} color={colors.border} style={{ marginLeft: 'auto' }} />
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => handleSection2Action('rate')} activeOpacity={0.7}>
              <Text style={styles.legalText}>Rate App</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => handleSection2Action('privacy')} activeOpacity={0.7}>
              <Text style={styles.legalText}>Privacy</Text>
            </TouchableOpacity>
            <Text style={styles.legalDot}>•</Text>
            <TouchableOpacity onPress={() => handleSection2Action('terms')} activeOpacity={0.7}>
              <Text style={styles.legalText}>Terms</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Settings Menu Modal ── */}
      <Modal
        visible={showSettingsMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsMenu(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowSettingsMenu(false)}
        >
          <View style={styles.settingsModal} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings & Account</Text>
              <TouchableOpacity onPress={() => setShowSettingsMenu(false)} activeOpacity={0.7}>
                <X size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Edit Profile */}
              <TouchableOpacity style={styles.modalItem} onPress={() => { setShowSettingsMenu(false); }}>
                <View style={styles.modalItemIcon}>
                  <UserPen size={14} color={colors.primary} />
                </View>
                <View style={styles.modalItemContent}>
                  <Text style={styles.modalItemTitle}>Edit Profile</Text>
                  <Text style={styles.modalItemDesc}>Update your information</Text>
                </View>
              </TouchableOpacity>

              {/* Settings Section */}
              <Text style={styles.modalSectionTitle}>Preferences</Text>
              {SECTION1_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.modalItem}
                    onPress={() => { setShowSettingsMenu(false); navigation.navigate(item.screen); }}
                  >
                    <View style={[styles.modalItemIcon, { backgroundColor: `${item.color}20` }]}>
                      <Icon size={14} color={item.color} />
                    </View>
                    <Text style={styles.modalItemTitle}>{t(`profile.${item.key}`)}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Legal Section */}
              <Text style={styles.modalSectionTitle}>About</Text>
              {SECTION2_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <TouchableOpacity
                    key={item.key}
                    style={styles.modalItem}
                    onPress={() => { setShowSettingsMenu(false); handleSection2Action(item.action); }}
                  >
                    <View style={[styles.modalItemIcon, { backgroundColor: `${item.color}20` }]}>
                      <Icon size={14} color={item.color} />
                    </View>
                    <Text style={styles.modalItemTitle}>{t(`profile.${item.key}`)}</Text>
                  </TouchableOpacity>
                );
              })}

              {/* Danger Zone */}
              <Text style={styles.modalSectionTitle}>Danger Zone</Text>
              <TouchableOpacity
                style={[styles.modalItem, styles.modalItemDanger]}
                onPress={() => { setShowSettingsMenu(false); setDeleteReason(''); setDeleteModalVisible(true); }}
              >
                <View style={styles.modalItemIcon}>
                  <Trash2 size={14} color={colors.error} />
                </View>
                <Text style={[styles.modalItemTitle, { color: colors.error }]}>Delete Account</Text>
              </TouchableOpacity>

              <Text style={styles.versionText}>Version 1.0.0</Text>
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ── iOS Date Picker Bottom Sheet ── */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={showDatePicker}
          transparent
          animationType="slide"
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

      {/* ── Android Date Picker ── */}
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
              { scale:     toastAnim.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
            ],
          },
        ]}
      >
        {toast.type === 'error' ? (
          <AlertCircle size={14} color={colors.white} style={{ marginRight: 9 }} />
        ) : (
          <CheckCircle size={14} color={colors.white} style={{ marginRight: 9 }} />
        )}
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

// ─────────────────────────────────────────────────────────────────────────────
// Styles - Clean, Simple, Elegant
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F0' },

  // ── Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PAD,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#F5F4F0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#EEECE9',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.white,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#EEECE9',
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilyBold,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  settingsBtn: {
    width: 36, height: 36,
    justifyContent: 'center', alignItems: 'center',
    gap: 5,
  },
  settingsDot: {
    width: 4, height: 4,
    borderRadius: 2,
    backgroundColor: colors.textSecondary,
  },

  // ── Content Container
  content: {
    flex: 1,
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },

  // ── Profile Card
  profileCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    paddingVertical: 20,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#EEECE9',
  },
  avatarCenter: {
    marginBottom: 12,
    position: 'relative',
  },
  avatarRing: {
    width: 80, height: 80, borderRadius: 40,
    borderWidth: 2.5, borderColor: colors.primary,
    backgroundColor: colors.border,
    justifyContent: 'center', alignItems: 'center',
  },
  avatarImg: {
    width: 77, height: 77, borderRadius: 38.5,
  },
  cameraBadge: {
    position: 'absolute', bottom: -2, right: -2,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: colors.white,
  },
  verifiedBadge: {
    position: 'absolute', bottom: -4, left: -4,
    backgroundColor: colors.white,
    borderRadius: 10, padding: 1.5,
  },

  // ── Edit Form
  editForm: {
    width: '100%',
  },
  fieldGroup: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  inputField: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontFamily: fontFamilyMedium,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.backgroundAlt,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingVertical: 11,
    marginTop: 6,
    justifyContent: 'center', alignItems: 'center',
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.white,
  },

  // ── Profile Name Display
  profileNameDisplay: {
    fontSize: 22,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamilyBold,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  profileSubtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    fontFamily: fontFamilyRegular,
    marginVertical: 2,
  },
  editLink: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    marginTop: 8,
  },

  // ── Stats Row
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EEECE9',
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statVal: {
    fontSize: 16,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamilyBold,
    color: colors.primary,
    marginTop: 4,
  },
  statLbl: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#F0EFEC',
  },

  // ── Settings Card
  settingsCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#EEECE9',
    marginBottom: 16,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0EFEC',
    gap: 12,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingText: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilyRegular,
  },

  // ── Footer
  footer: {
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legalText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: fontFamilyRegular,
  },
  legalDot: {
    fontSize: fontSize.xs,
    color: colors.border,
  },
  logoutBtn: {
    paddingVertical: 8,
  },
  logoutText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.error,
  },

  // ── Settings Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  settingsModal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: PAD,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamilyBold,
    color: colors.textPrimary,
  },
  modalScroll: {
    paddingHorizontal: PAD,
    paddingVertical: 12,
  },
  modalSectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  modalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: borderRadius.md,
    marginBottom: 6,
    gap: 10,
  },
  modalItemIcon: {
    width: 32, height: 32,
    backgroundColor: colors.backgroundAlt,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalItemTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.textPrimary,
  },
  modalItemContent: {
    flex: 1,
  },
  modalItemDesc: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: fontFamilyRegular,
    marginTop: 2,
  },
  modalItemDanger: {
    opacity: 0.85,
  },
  versionText: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: fontFamilyRegular,
  },

  // ── Date Picker Modal
  dateModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  dateModalSheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: PAD, paddingBottom: 32, paddingTop: 12,
    alignItems: 'center',
  },
  dateModalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center', marginBottom: 14,
  },
  dateModalTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.textPrimary,
    marginBottom: 12,
  },
  dateModalConfirm: {
    width: '100%', height: 46,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    justifyContent: 'center', alignItems: 'center',
    marginTop: 16,
  },
  dateModalConfirmText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    fontFamily: fontFamilyBold,
    color: colors.white
  },

  // ── Toast
  toast: {
    position: 'absolute',
    top: 68, left: PAD, right: PAD,
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: borderRadius.lg,
    zIndex: 999,
  },
  toastSuccess: { backgroundColor: colors.primary },
  toastError: { backgroundColor: colors.error },
  toastText: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.white,
  },

  // ── Delete Modal
  modalContent: {
    width: '100%', maxWidth: 340,
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg, padding: 22,
  },
  modalSubtitle: {
    fontSize: fontSize.base,
    color: colors.textSecondary,
    fontFamily: fontFamilyRegular,
    marginBottom: 14
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.sm,
    color: colors.textPrimary,
    fontFamily: fontFamilyRegular,
    minHeight: 72,
    marginBottom: 18,
  },
  modalButtons: { flexDirection: 'row', gap: 10 },
  modalBtnCancel: {
    flex: 1, height: 42, borderRadius: borderRadius.md,
    backgroundColor: colors.backgroundAlt,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnCancelText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.textPrimary
  },
  modalBtnDelete: {
    flex: 1, height: 42, borderRadius: borderRadius.md,
    backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
  },
  modalBtnDeleteText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    fontFamily: fontFamilySemiBold,
    color: colors.white
  },
});
