"use client";

import type { Board, Clue } from "../types/game";

type JeopardyBoardProps = {
  board: Board;
  revealedClueIds: Set<string>;
  onClueSelect: (clue: Clue) => void;
  selectedClueId?: string | null;
  canSelect?: boolean;
};

export default function JeopardyBoard({
  board,
  revealedClueIds,
  onClueSelect,
  selectedClueId,
  canSelect = true,
}: JeopardyBoardProps) {
  // Sort clues by value within each category for proper row display
  const values = [200, 400, 600, 800, 1000];

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="grid grid-cols-5 gap-3">
        {/* Category headers */}
        {board.categories.map((category) => (
          <div
            key={category.id}
            className="flex min-h-[88px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 px-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
          >
            {category.title}
          </div>
        ))}
        {/* Clue grid - row by row (by value) */}
        {values.map((value) =>
          board.categories.map((category) => {
            const clue = category.clues.find((c) => c.value === value);
            if (!clue) return <div key={`${category.id}-${value}`} />;
            
            const isRevealed = revealedClueIds.has(clue.id);
            const isSelected = clue.id === selectedClueId;
            
            return (
              <button
                key={clue.id}
                type="button"
                onClick={() => onClueSelect(clue)}
                disabled={isRevealed || !canSelect}
                className={`flex min-h-[90px] items-center justify-center rounded-xl border px-2 text-lg font-semibold tracking-wide transition ${
                  isRevealed
                    ? "cursor-not-allowed border-slate-800 bg-slate-950/30 text-slate-600"
                    : isSelected
                    ? "border-amber-400 bg-amber-400/30 text-amber-50 ring-2 ring-amber-400/50"
                    : canSelect
                    ? "border-amber-400/30 bg-amber-400/10 text-amber-100 hover:border-amber-300 hover:text-amber-50"
                    : "border-amber-400/20 bg-amber-400/5 text-amber-200/50 cursor-not-allowed"
                }`}
              >
                ${clue.value}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
