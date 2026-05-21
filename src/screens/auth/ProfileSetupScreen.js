import { User } from 'lucide-react-native';
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
  Dimensions,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AppButton from '../../components/common/AppButton';
import AppInput from '../../components/common/AppInput';
import { colors } from '../../constants/colors';
import { fontSize, fontWeight } from '../../constants/typography';
import { shadow } from '../../constants/layout';
import useAuthStore from '../../store/authStore';
import { updateProfile } from '../../services/authService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('screen');

export default function ProfileSetupScreen({ navigation }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
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
    <View style={styles.flex}>
      {/* Full-screen background — sits behind everything */}
      <View style={styles.bgContainer}>
        <Image
          source={require('../../../assets/bg-pattern.png')}
          style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, position: 'absolute' }}
          resizeMode="cover"
        />
        <View style={StyleSheet.absoluteFill}>
          <Svg width={SCREEN_WIDTH} height={SCREEN_HEIGHT}>
            <Defs>
              <LinearGradient id="nameGrad" x1="0" y1="1" x2="0" y2="0">
                <Stop offset="0"   stopColor={colors.primaryDark}  stopOpacity="0.92" />
                <Stop offset="0.5" stopColor={colors.primary}      stopOpacity="0.87" />
                <Stop offset="1"   stopColor={colors.primaryLight} stopOpacity="0.82" />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#nameGrad)" />
          </Svg>
        </View>
      </View>

      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <KeyboardAvoidingView
            style={styles.kav}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
            enabled={Platform.OS === 'ios'}
          >
            <View style={[styles.center, { paddingBottom: Math.max(insets.bottom, 24) }]}>
              {/* Logo */}
              <View style={styles.logoCircle}>
                <Image
                  source={require('../../../assets/icon.png')}
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              </View>

              <Text style={styles.heading}>{t('auth.nameTitle')}</Text>
              <Text style={styles.sub}>{t('auth.nameSub')}</Text>

              {/* Card */}
              <View style={styles.card}>
                <View style={styles.avatarCircle}>
                  <User size={36} color={colors.primary} />
                </View>

                <AppInput
                  placeholder={t('auth.namePlaceholder')}
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="words"
                  autoFocus
                  style={styles.input}
                />

                <AppButton
                  title={t('auth.letsGo')}
                  onPress={handleContinue}
                  loading={loading}
                  disabled={!isNameValid || loading}
                  shimmer
                  style={styles.button}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.primaryDark,
  },
  bgContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  safe: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  kav: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 88,
    height: 88,
  },
  heading: {
    fontSize: 28,
    fontWeight: fontWeight.bold,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  sub: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  card: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingVertical: 28,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...shadow.lg,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    marginBottom: 20,
  },
  input: {
    width: '100%',
    marginBottom: 4,
  },
  button: {
    width: '100%',
    marginTop: 16,
    height: 56,
    borderRadius: 16,
  },
});
