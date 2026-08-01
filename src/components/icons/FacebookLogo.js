import React from 'react';
import Svg, { Path, Circle } from 'react-native-svg';

export default function FacebookLogo({ size = 22 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="12" fill="#1877F2" />
      <Path
        d="M16.671 15.469l.532-3.469h-3.328v-2.25c0-.949.465-1.874 1.956-1.874h1.513V4.923s-1.373-.235-2.686-.235c-2.741 0-4.533 1.662-4.533 4.669v2.643H7.078v3.469h3.047v8.385a12.09 12.09 0 003.75 0v-8.385h2.796z"
        fill="#FFFFFF"
      />
    </Svg>
  );
}
