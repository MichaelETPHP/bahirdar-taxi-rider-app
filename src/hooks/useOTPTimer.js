import { useState, useEffect, useRef, useCallback } from 'react';

const TIMER_DURATION = 60;

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
