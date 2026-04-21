import React, { useState } from 'react';
import { View, TextInput, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors } from '../../constants/colors';
import { inputHeight, borderRadius } from '../../constants/layout';
import { fontSize, fontWeight } from '../../constants/typography';

export default function AppInput({
  label,
  error,
  placeholder,
  value,
  onChangeText,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  secureTextEntry = false,
  editable = true,
  multiline = false,
  numberOfLines,
  maxLength,
  style,
  inputStyle,
  leftIcon,
  rightIcon,
  onRightIconPress,
  autoFocus = false,
  embedded = false,
  onFocus,
  onBlur,
  inputRef,
  placeholderTextColor,
  autoComplete = 'off',
  textContentType,
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.container, embedded && styles.embeddedContainer, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View
        style={[
          styles.inputWrapper,
          embedded && styles.embeddedWrapper,
          focused && styles.focused,
          error && styles.errorBorder,
          !editable && styles.disabled,
          multiline && styles.multiline,
        ]}
      >
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        <TextInput
          ref={inputRef}
          style={[
            styles.input,
            leftIcon && styles.inputWithLeft,
            rightIcon && styles.inputWithRight,
            multiline && styles.inputMultiline,
            inputStyle,
          ]}
          placeholder={placeholder}
          placeholderTextColor={placeholderTextColor ?? colors.textSecondary}
          value={value}
          onChangeText={(text) => {
            if ((keyboardType === 'phone-pad' || keyboardType === 'number-pad') && text.length !== value.length) {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onChangeText(text);
          }}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          editable={editable}
          multiline={multiline}
          numberOfLines={numberOfLines}
          maxLength={maxLength}
          autoFocus={autoFocus}
          onFocus={() => {
            setFocused(true);
            if (keyboardType === 'phone-pad' || keyboardType === 'number-pad') {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }
            onFocus?.();
          }}
          onBlur={() => {
            setFocused(false);
            onBlur?.();
          }}
          cursorColor={colors.primary}
          selectionColor={colors.primary}
          autoComplete={autoComplete}
          textContentType={textContentType}
        />
        {rightIcon && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={onRightIconPress}
            disabled={!onRightIconPress}
          >
            {rightIcon}
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  embeddedContainer: {
    marginBottom: 0,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: inputHeight,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 26,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
  },
  embeddedWrapper: {
    borderWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingVertical: 0,
    height: undefined,
    minHeight: undefined,
    flex: 1,
  },
  multiline: {
    height: undefined,
    minHeight: inputHeight,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  focused: {
    borderColor: colors.primary,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  disabled: {
    backgroundColor: colors.backgroundAlt,
  },
  input: {
    flex: 1,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    padding: 0,
  },
  inputWithLeft: {
    marginLeft: 8,
  },
  inputWithRight: {
    marginRight: 8,
  },
  inputMultiline: {
    textAlignVertical: 'top',
  },
  leftIcon: {
    marginRight: 4,
  },
  rightIcon: {
    marginLeft: 4,
  },
  errorText: {
    fontSize: fontSize.sm,
    color: colors.error,
    marginTop: 4,
  },
});
