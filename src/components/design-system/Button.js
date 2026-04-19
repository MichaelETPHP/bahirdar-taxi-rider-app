import React from "react";
import { TouchableOpacity, Text, View, ActivityIndicator } from "react-native";
import { styled } from "nativewind";

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledView = styled(View);

/**
 * Premium Button component for BahirdarRide.
 * Supports variants: primary, secondary, outline, ghost.
 */
export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
  labelClassName = "",
  iconBefore,
  iconAfter,
}) {
  const getContainerStyles = () => {
    let styles = "flex-row items-center justify-center rounded-xl px-4 ";
    
    // Size logic
    if (size === "sm") styles += "h-10 ";
    else if (size === "lg") styles += "h-14 ";
    else styles += "h-12 "; // md
    
    // Variant logic
    if (disabled || loading) {
      styles += "bg-gray-200 ";
    } else if (variant === "primary") {
      styles += "bg-primary ";
    } else if (variant === "secondary") {
      styles += "bg-secondary ";
    } else if (variant === "outline") {
      styles += "border-2 border-primary bg-transparent ";
    } else if (variant === "ghost") {
      styles += "bg-transparent ";
    }
    
    return styles + className;
  };

  const getLabelStyles = () => {
    let styles = "font-italic text-base font-semibold ";
    
    if (disabled || loading) {
      styles += "text-gray-400 ";
    } else if (variant === "primary") {
      styles += "text-white ";
    } else if (variant === "secondary") {
      styles += "text-primary ";
    } else if (variant === "outline" || variant === "ghost") {
      styles += "text-primary ";
    }
    
    return styles + labelClassName;
  };

  return (
    <StyledTouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      className={getContainerStyles()}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "white" : "#00674F"} />
      ) : (
        <StyledView className="flex-row items-center">
          {iconBefore && <StyledView className="mr-2">{iconBefore}</StyledView>}
          <StyledText className={getLabelStyles()}>{label}</StyledText>
          {iconAfter && <StyledView className="ml-2">{iconAfter}</StyledView>}
        </StyledView>
      )}
    </StyledTouchableOpacity>
  );
}
