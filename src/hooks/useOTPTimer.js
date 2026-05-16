import { useState, useEffect, useRef, useCallback } from 'react';

// 62 seconds: 2-second buffer over the backend's 60-second cooldown.
// Prevents the race where the frontend timer hits 0 but the server-side
// cooldown hasn't quite expired yet, causing a rejected resend.
const TIMER_DURATION = 62;

export default function useOTPTimer() {
  const [seconds, setSeconds] = useState(TIMER_DURATION);
  const [canResend, setCanResend] = useState(false);
  const intervalRef = useRef(null);

  const startTimer = useCallback(() => {
    setSeconds(TIMER_DURATION);
    setCanResend(false);
    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    startTimer();
    return () => clearInterval(intervalRef.current);
  }, [startTimer]);

  const formatTime = () => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return { seconds, canResend, formattedTime: formatTime(), resend: startTimer };
}
