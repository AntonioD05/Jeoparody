"use client";

import { useCallback, useRef, useEffect } from "react";

export function useVictorySound() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const play = useCallback(() => {
    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio("/Trumpet%20Sound%20Victory.mp3");
      audioRef.current.volume = 0.6;
    }

    // Reset to beginning in case it's already played
    audioRef.current.currentTime = 0;

    audioRef.current.play().catch((error) => {
      // Autoplay may be blocked by browser policy - that's okay
      console.log("Could not play victory sound:", error);
    });
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  return { play, stop };
}
