"use client";

import { useCallback, useRef, useState } from "react";

type VoiceoverState = "idle" | "loading" | "playing" | "error";

export function useVoiceover() {
  const [state, setState] = useState<VoiceoverState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const speak = useCallback(async (text: string) => {
    // Cancel any ongoing request or playback
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setState("loading");
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch("/api/text-to-speech", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to generate speech");
      }

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setState("playing");
      audio.onended = () => {
        setState("idle");
        URL.revokeObjectURL(audioUrl);
      };
      audio.onerror = () => {
        setState("error");
        URL.revokeObjectURL(audioUrl);
      };

      await audio.play();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setState("idle");
        return;
      }
      console.error("Voiceover error:", error);
      setState("error");
    }
  }, []);

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setState("idle");
  }, []);

  return {
    speak,
    stop,
    state,
    isLoading: state === "loading",
    isPlaying: state === "playing",
  };
}
