"use client";

import { useEffect, useState, useRef } from "react";
import type { Clue } from "../types/game";
import { useVoiceover } from "../hooks/useVoiceover";

type ClueModalProps = {
  clue: Clue | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answer: string, clue: Clue) => void;
  isSubmitting?: boolean;
  canSkip?: boolean;
  onSkip?: () => void;
  canAnswer?: boolean;
  isMuted?: boolean;
};

export default function ClueModal({
  clue,
  isOpen,
  onClose,
  onSubmit,
  isSubmitting = false,
  canSkip = false,
  onSkip,
  canAnswer = true,
  isMuted = false,
}: ClueModalProps) {
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, stop, isLoading, isPlaying } = useVoiceover();

  useEffect(() => {
    if (isOpen && clue) {
      setAnswer("");
      // Narrate the question (unless muted)
      if (!isMuted) {
        speak(clue.question);
      }
      // Focus input when modal opens
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      stop();
    }
  }, [isOpen, clue?.id, isMuted]);

  if (!isOpen || !clue) {
    return null;
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isSubmitting && answer.trim()) {
      onSubmit(answer, clue);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={canSkip ? onClose : undefined}
        role="presentation"
      />
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-8 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {clue.value} points
              </p>
              {!isMuted && (isLoading || isPlaying) && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                  </span>
                  {isLoading ? "Loading..." : "Speaking"}
                </span>
              )}
            </div>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {clue.question}
            </h3>
          </div>
          {canSkip && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              disabled={isSubmitting}
              className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-rose-400 hover:text-rose-200 disabled:opacity-50"
            >
              Skip
            </button>
          )}
        </div>
        {canAnswer ? (
          <form onSubmit={handleSubmit} className="mt-6">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Your Answer
            </label>
            <input
              ref={inputRef}
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="Type your response..."
              disabled={isSubmitting}
              className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={isSubmitting || !answer.trim()}
              className="mt-4 w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Submitting..." : "Submit Answer"}
            </button>
          </form>
        ) : (
          <div className="mt-6 rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-6 text-center">
            <p className="text-sm text-slate-400">Waiting for player to answer...</p>
          </div>
        )}
      </div>
    </div>
  );
}
