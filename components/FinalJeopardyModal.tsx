"use client";

import { useState, useEffect, useRef } from "react";
import { useVoiceover } from "../hooks/useVoiceover";
import type { FinalJeopardy, FinalJeopardyWager, Player } from "../types/game";

type FinalJeopardyPhase = "wager" | "answering" | "revealing";

type FinalJeopardyModalProps = {
  finalJeopardy: FinalJeopardy | null;
  phase: FinalJeopardyPhase;
  currentPlayerId: string | null;
  players: Player[];
  wagers: FinalJeopardyWager[];
  onSubmitWager: (wager: number) => void;
  onSubmitAnswer: (answer: string) => void;
  onRevealResults: () => void;
  isSubmitting: boolean;
  isMuted?: boolean;
};

export default function FinalJeopardyModal({
  finalJeopardy,
  phase,
  currentPlayerId,
  players,
  wagers,
  onSubmitWager,
  onSubmitAnswer,
  onRevealResults,
  isSubmitting,
  isMuted = false,
}: FinalJeopardyModalProps) {
  const [wagerAmount, setWagerAmount] = useState<string>("");
  const [answer, setAnswer] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { speak, stop, isLoading, isPlaying } = useVoiceover();

  // Get current player
  const currentPlayer = players.find((p) => p.id === currentPlayerId);
  const currentScore = currentPlayer?.score ?? 0;
  const maxWager = currentScore > 0 ? currentScore : 1000;

  // Check if current player has already submitted
  const playerWager = wagers.find((w) => w.playerId === currentPlayerId);
  const hasSubmittedWager = !!playerWager;
  const hasSubmittedAnswer = playerWager?.validated === true;

  // Read question aloud when answering phase starts
  useEffect(() => {
    if (phase === "answering" && finalJeopardy && !isMuted) {
      speak(`Final Jeopardy! The category is ${finalJeopardy.category}. ${finalJeopardy.question}`);
    }
    return () => stop();
  }, [phase, finalJeopardy, isMuted, speak, stop]);

  // Focus input when modal opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [phase]);

  if (!finalJeopardy) {
    return null;
  }

  const handleWagerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const wager = parseInt(wagerAmount, 10);
    if (!isNaN(wager) && wager >= 0 && wager <= maxWager) {
      onSubmitWager(wager);
    }
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (answer.trim()) {
      onSubmitAnswer(answer);
    }
  };

  // Count how many have wagered/answered
  const wageredCount = wagers.length;
  const answeredCount = wagers.filter((w) => w.validated).length;
  const playerCount = players.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl rounded-3xl border border-amber-400/30 bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950 p-8 text-slate-100 shadow-2xl">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.4em] text-amber-400">
              Final Jeopardy!
            </span>
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
          <h2 className="text-2xl font-bold text-white">{finalJeopardy.category}</h2>
        </div>

        {/* Wager Phase */}
        {phase === "wager" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5 text-center">
              <p className="text-slate-300">
                Your current score: <span className="font-bold text-white">${currentScore}</span>
              </p>
              <p className="mt-2 text-sm text-slate-400">
                You may wager up to ${maxWager}
              </p>
            </div>

            {hasSubmittedWager ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                  <p className="text-emerald-200">
                    Wager submitted: <span className="font-bold">${playerWager?.wager}</span>
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Waiting for other players...
                  </p>
                </div>
                <div className="text-center text-sm text-slate-400">
                  {wageredCount} of {playerCount} players have wagered
                </div>
              </div>
            ) : (
              <form onSubmit={handleWagerSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Your Wager
                  </label>
                  <input
                    ref={inputRef}
                    type="number"
                    min={0}
                    max={maxWager}
                    value={wagerAmount}
                    onChange={(e) => setWagerAmount(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-lg text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="Enter your wager..."
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !wagerAmount}
                  className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Lock In Wager"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Answering Phase */}
        {phase === "answering" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
              <p className="text-lg text-white">{finalJeopardy.question}</p>
            </div>

            <div className="text-center text-sm text-slate-400">
              Your wager: <span className="font-bold text-amber-200">${playerWager?.wager ?? 0}</span>
            </div>

            {hasSubmittedAnswer ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center">
                  <p className="text-emerald-200">
                    Answer submitted!
                  </p>
                  <p className="mt-2 text-sm text-slate-400">
                    Waiting for other players...
                  </p>
                </div>
                <div className="text-center text-sm text-slate-400">
                  {answeredCount} of {playerCount} players have answered
                </div>
              </div>
            ) : (
              <form onSubmit={handleAnswerSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    Your Answer
                  </label>
                  <input
                    ref={inputRef}
                    type="text"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-lg text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
                    placeholder="What is..."
                    disabled={isSubmitting}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting || !answer.trim()}
                  className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Answer"}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Revealing Phase */}
        {phase === "revealing" && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Question
              </p>
              <p className="text-lg text-white">{finalJeopardy.question}</p>
            </div>

            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                Correct Answer
              </p>
              <p className="text-xl font-bold text-emerald-100">{finalJeopardy.answer}</p>
              {finalJeopardy.sourceSnippet && (
                <p className="mt-2 text-sm text-slate-400">{finalJeopardy.sourceSnippet}</p>
              )}
            </div>

            {/* Player Results */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Results
              </p>
              {wagers.map((wager) => {
                const player = players.find((p) => p.id === wager.playerId);
                return (
                  <div
                    key={wager.playerId}
                    className={`rounded-xl border p-4 ${
                      wager.isCorrect
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-rose-500/30 bg-rose-500/10"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">{player?.name ?? "Unknown"}</p>
                        <p className="text-sm text-slate-300">
                          Answered: <span className="italic">{wager.answer}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p
                          className={`text-lg font-bold ${
                            wager.isCorrect ? "text-emerald-300" : "text-rose-300"
                          }`}
                        >
                          {wager.isCorrect ? "+" : "-"}${wager.wager}
                        </p>
                        <p className="text-xs text-slate-400">
                          {wager.isCorrect ? "Correct!" : "Incorrect"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={onRevealResults}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-100 transition hover:border-amber-300 hover:bg-amber-400/20 disabled:opacity-50"
            >
              {isSubmitting ? "Calculating..." : "See Final Scores"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
