import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppButton from '../../components/common/AppButton';
import AppInput from '../../components/common/AppInput';
import { FontAwesome5 } from '@expo/vector-icons';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import useAuthStore from '../../store/authStore';
import { updateProfile } from '../../services/authService';

export default function ProfileSetupScreen({ navigation }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const token = useAuthStore((s) => s.token);
  const updateUser = useAuthStore((s) => s.updateUser);
  const setAuthenticated = useAuthStore((s) => s.setAuthenticated);

  const isNameValid = name.trim().length > 0;

  const handleContinue = async () => {
    if (!isNameValid || loading) return;
    setLoading(true);
    try {
      const res = await updateProfile({ fullName: name.trim() }, token);
      const savedName = res?.data?.full_name ?? res?.data?.user?.fullName ?? name.trim();
      updateUser({ fullName: savedName, isVerified: true });
      setAuthenticated(true, false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Could not save your name. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.flex}>
        <Image
          source={require('../../../assets/splash.png')}
          style={styles.backgroundImage}
          resizeMode="cover"
        />
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          enabled={Platform.OS === 'ios'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false} delayPressIn={0}>
            <View style={[styles.flex, styles.centered]}>
              <View style={styles.content}>
                <View style={styles.avatarSection}>
                  <View style={styles.avatarCircle}>
                    <FontAwesome5 name="user" size={44} color={colors.primary} solid />
                  </View>
                </View>

                <Text style={styles.heading}>{t('auth.nameTitle')}</Text>
                <Text style={styles.sub}>{t('auth.nameSub')}</Text>

                <AppInput
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus
                />

                <AppButton
                  title={t('auth.letsGo')}
                  onPress={handleContinue}
                  loading={loading}
                  disabled={!isNameValid || loading}
                  style={styles.button}
                />
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  flex: { flex: 1 },
  centered: {
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 32,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  heading: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sub: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    marginBottom: 28,
    lineHeight: 22,
  },
  button: {
    marginTop: 12,
  },
});
