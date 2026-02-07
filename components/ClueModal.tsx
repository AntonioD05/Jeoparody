"use client";

import { useEffect, useState } from "react";
import type { Clue } from "../types/game";

type ClueModalProps = {
  clue: Clue | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (answer: string, clue: Clue) => void;
};

export default function ClueModal({
  clue,
  isOpen,
  onClose,
  onSubmit,
}: ClueModalProps) {
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    if (isOpen) {
      setAnswer("");
    }
  }, [isOpen, clue?.id]);

  if (!isOpen || !clue) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={onClose}
        role="presentation"
      />
      <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-8 text-slate-100 shadow-2xl">
        <div className="flex items-start justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
              {clue.value} points
            </p>
            <h3 className="mt-3 text-2xl font-semibold text-white">
              {clue.question}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300 transition hover:border-amber-300 hover:text-amber-200"
          >
            Close
          </button>
        </div>
        <div className="mt-6">
          <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Your Answer
          </label>
          <input
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="Type your response..."
            className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-white outline-none transition focus:border-amber-300"
          />
          <button
            type="button"
            onClick={() => onSubmit(answer, clue)}
            className="mt-4 w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-amber-50"
          >
            Submit Answer
          </button>
        </div>
      </div>
    </div>
  );
}
