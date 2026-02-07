"use client";

import type { Player } from "../types/game";

type ScoreboardProps = {
  players: Player[];
  currentPlayerId?: string;
};

export default function Scoreboard({ players, currentPlayerId }: ScoreboardProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Scoreboard</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {players.map((player) => {
          const isCurrent = player.id === currentPlayerId;
          return (
            <li
              key={player.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                isCurrent
                  ? "border-amber-300 bg-amber-400/10 text-amber-100"
                  : "border-slate-800/70 bg-slate-950/40 text-slate-100"
              }`}
            >
              <span className="font-medium">{player.name}</span>
              <span className="text-sm font-semibold tabular-nums">
                {player.score ?? 0}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
