import React, { useRef, useEffect } from "react";
import { TouchableOpacity, Text, View, ActivityIndicator, Animated, StyleSheet } from "react-native";
import { styled } from "nativewind";
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';

const StyledTouchableOpacity = styled(TouchableOpacity);
const StyledText = styled(Text);
const StyledView = styled(View);

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
  shimmer = false,
}) {
  const shimmerPos = useRef(new Animated.Value(-1.5)).current;

  useEffect(() => {
    if (shimmer && !disabled && !loading) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerPos, {
            toValue: 1.5,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.delay(2000),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [shimmer, disabled, loading]);

  const handlePress = () => {
    if (onPress) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  };

  const getContainerStyles = () => {
    let styles = "flex-row items-center justify-center rounded-full px-4 overflow-hidden ";

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
    } else if (variant === "danger") {
      styles += "bg-red-600 ";
    } else if (variant === "outline") {
      styles += "border-2 border-primary bg-transparent ";
    } else if (variant === "ghost") {
      styles += "bg-transparent ";
    }
    
    return styles + className;
  };

  const getLabelStyles = () => {
    let styles = "font-italic text-xl font-semibold ";
    
    if (disabled || loading) {
      styles += "text-gray-400 ";
    } else if (variant === "primary") {
      styles += "text-white ";
    } else if (variant === "secondary") {
      styles += "text-primary ";
    } else if (variant === "danger") {
      styles += "text-white ";
    } else if (variant === "outline" || variant === "ghost") {
      styles += "text-primary ";
    }
    
    return styles + labelClassName;
  };

  const shimmerTranslateX = shimmerPos.interpolate({
    inputRange: [-1.5, 1.5],
    outputRange: [-300, 300],
  });

  return (
    <StyledTouchableOpacity
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      className={getContainerStyles()}
    >
      {shimmer && !disabled && !loading && (
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: shimmerTranslateX }, { skewX: '-25deg' }] },
          ]}
        >
          <LinearGradient
            colors={['transparent', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.0)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}

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
