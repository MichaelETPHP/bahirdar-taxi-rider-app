import React, { useState } from "react";
import { View, TextInput, Text } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);
const StyledTextInput = styled(TextInput);
const StyledText = styled(Text);

/**
 * Premium Input component for BahirdarRide.
 */
export default function Input({
  label,
  error,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  iconLeft,
  iconRight,
  containerClassName = "",
  inputClassName = "",
  ...props
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <StyledView className={`mb-4 ${containerClassName}`}>
      {label && (
        <StyledText className="mb-2 font-italic text-sm font-medium text-gray-700">
          {label}
        </StyledText>
      )}
      
      <StyledView
        className={`flex-row items-center rounded-xl border-2 px-3 h-14 bg-gray-50/50 ${
          error 
            ? "border-destructive/50" 
            : isFocused 
              ? "border-primary" 
              : "border-gray-100"
        }`}
      >
        {iconLeft && <StyledView className="mr-3">{iconLeft}</StyledView>}
        
        <StyledTextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholderTextColor="#9CA3AF"
          className={`flex-1 font-italic text-base text-gray-900 ${inputClassName}`}
          {...props}
        />
        
        {iconRight && <StyledView className="ml-3">{iconRight}</StyledView>}
      </StyledView>
      
      {error && (
        <StyledText className="mt-1 text-xs text-destructive font-italic">
          {error}
        </StyledText>
      )}
    </StyledView>
  );
}
