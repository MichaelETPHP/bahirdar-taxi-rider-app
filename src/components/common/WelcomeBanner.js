import React from 'react';
import SuccessBanner from './SuccessBanner';

// Login-specific wrapper around SuccessBanner — see that component to reuse
// this same confirmation-pill pattern for any other success message.
export default function WelcomeBanner({ visible, name, onHide }) {
  const message = name ? `Welcome back, ${name}!` : 'Login successful';
  return <SuccessBanner visible={visible} message={message} onHide={onHide} />;
}
