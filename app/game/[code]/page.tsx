"use client";

import { use, useState } from "react";
import ClueModal from "../../../components/ClueModal";
import JeopardyBoard from "../../../components/JeopardyBoard";
import Scoreboard from "../../../components/Scoreboard";
import StatusBadge from "../../../components/StatusBadge";
import type { Board, Clue, Player } from "../../../types/game";

interface GamePageProps {
  params: Promise<{
    code: string;
  }>;
}

export default function GamePage({ params }: GamePageProps) {
  const { code } = use(params);
  const [players] = useState<Player[]>([]);
  const [board] = useState<Board | null>(null);
  const [revealedClueIds, setRevealedClueIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [lastResult, setLastResult] = useState<{
    clue: Clue;
    isCorrect: boolean;
  } | null>(null);

  const currentPlayerId: string | null = null;

  const handleClueSelect = (clue: Clue) => {
    if (revealedClueIds.has(clue.id)) {
      return;
    }
    setSelectedClue(clue);
  };

  const handleSubmit = (answer: string, clue: Clue) => {
    const isCorrect = answer.trim().length > 0;
    setLastResult({ clue, isCorrect });
    setRevealedClueIds((prev) => {
      const next = new Set(prev);
      next.add(clue.id);
      return next;
    });
    setSelectedClue(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
              Jeoparody
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-white md:text-3xl">
                Room {code}
              </h1>
              <StatusBadge label="Playing" />
            </div>
          </div>
          <div className="text-sm text-slate-300">
            Round 1 · Board live
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Scoreboard
            players={players}
            currentPlayerId={currentPlayerId}
          />
          <div className="flex flex-col gap-6">
            {!board ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-300">
                Generating board...
              </div>
            ) : (
              <JeopardyBoard
                board={board}
                revealedClueIds={revealedClueIds}
                onClueSelect={handleClueSelect}
              />
            )}

            {lastResult ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                      lastResult.isCorrect
                        ? "bg-emerald-400/10 text-emerald-200"
                        : "bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    {lastResult.isCorrect ? "Correct" : "Wrong"}
                  </span>
                  <span className="text-sm text-slate-300">
                    Reveal answer for {lastResult.clue.value} points
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">
                    Answer: {lastResult.clue.answer}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {lastResult.clue.sourceSnippet}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <ClueModal
        clue={selectedClue}
        isOpen={Boolean(selectedClue)}
        onClose={() => setSelectedClue(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
