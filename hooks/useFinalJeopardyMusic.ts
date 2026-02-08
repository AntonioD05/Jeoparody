"use client";

import { useCallback, useRef, useEffect } from "react";

export function useFinalJeopardyMusic() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isPlayingRef = useRef(false);

  const play = useCallback(() => {
    if (isPlayingRef.current) return;

    // Create audio element if it doesn't exist
    if (!audioRef.current) {
      audioRef.current = new Audio("/final-jeopardy-theme.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.25; // 50% volume so it doesn't overpower voiceover
    }

    audioRef.current.play().catch((error) => {
      // Autoplay may be blocked by browser policy - that's okay
      console.log("Could not autoplay Final Jeopardy music:", error);
    });
    isPlayingRef.current = true;
  }, []);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    isPlayingRef.current = false;
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
