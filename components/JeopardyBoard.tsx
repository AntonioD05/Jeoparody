"use client";

import type { Board, Clue } from "../types/game";

type JeopardyBoardProps = {
  board: Board;
  revealedClueIds: Set<string>;
  onClueSelect: (clue: Clue) => void;
};

export default function JeopardyBoard({
  board,
  revealedClueIds,
  onClueSelect,
}: JeopardyBoardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
      <div className="grid grid-cols-5 gap-3">
        {board.categories.map((category) => (
          <div
            key={category.id}
            className="flex min-h-[88px] items-center justify-center rounded-xl border border-slate-800 bg-slate-950/60 px-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-200"
          >
            {category.title}
          </div>
        ))}
        {board.categories.map((category) =>
          category.clues.map((clue) => {
            const isRevealed = revealedClueIds.has(clue.id);
            return (
              <button
                key={clue.id}
                type="button"
                onClick={() => onClueSelect(clue)}
                disabled={isRevealed}
                className={`flex min-h-[90px] items-center justify-center rounded-xl border px-2 text-lg font-semibold tracking-wide transition ${
                  isRevealed
                    ? "cursor-not-allowed border-slate-800 bg-slate-950/30 text-slate-600"
                    : "border-amber-400/30 bg-amber-400/10 text-amber-100 hover:border-amber-300 hover:text-amber-50"
                }`}
              >
                ${clue.value}
              </button>
            );
          }),
        )}
      </div>
    </div>
  );
}
