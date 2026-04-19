import { useEffect, useRef } from "react";
import * as Haptics from "expo-haptics";
import { Audio } from "expo-av";

/**
 * Hook to handle Haptics and Sound feedback for trip events.
 */
export default function useSoundHaptics() {
  const soundRef = useRef();

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, []);

  /**
   * Triggers a "success" haptic pattern and plays an alert sound.
   * Useful when a trip is matched or a new offer arrives.
   */
  const playMatchFeedback = async () => {
    try {
      // 1. Success Haptics
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // 2. Play Sound
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/match.mp3")
      );
      soundRef.current = sound;
      await sound.playAsync();
    } catch (error) {
      console.warn("[UX Feedback] Failed to play sound/haptics:", error);
    }
  };

  /**
   * Triggers a subtle selection haptic.
   */
  const playActionHaptic = () => {
    Haptics.selectionAsync();
  };

  /**
   * Triggers an error haptic pattern.
   */
  const playErrorFeedback = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  return { playMatchFeedback, playActionHaptic, playErrorFeedback };
}
