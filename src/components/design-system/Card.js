import React from "react";
import { View } from "react-native";
import { styled } from "nativewind";

const StyledView = styled(View);

/**
 * Premium Card component for BahirdarRide.
 */
export default function Card({ children, className = "", noPadding = false }) {
  return (
    <StyledView
      className={`mx-4 my-2 rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 ${
        !noPadding ? "p-4" : ""
      } ${className}`}
      style={{
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 3,
      }}
    >
      {children}
    </StyledView>
  );
}
