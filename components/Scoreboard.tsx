"use client";

import type { Player } from "../types/game";

type ScoreboardProps = {
  players: Player[];
  currentPlayerId?: string | null;
  turnPlayerId?: string | null;
};

export default function Scoreboard({ players, currentPlayerId, turnPlayerId }: ScoreboardProps) {
  // Sort players by score (descending)
  const sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-lg font-semibold text-white">Scoreboard</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {sortedPlayers.map((player, index) => {
          const isCurrent = player.id === currentPlayerId;
          const isTurn = player.id === turnPlayerId;
          return (
            <li
              key={player.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${
                isTurn
                  ? "border-amber-400 bg-amber-400/20 text-amber-100 ring-1 ring-amber-400/50"
                  : isCurrent
                  ? "border-amber-300/50 bg-amber-400/10 text-amber-100"
                  : "border-slate-800/70 bg-slate-950/40 text-slate-100"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 w-4">{index + 1}.</span>
                <span className="font-medium">{player.name}</span>
                {isCurrent && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-300">(you)</span>
                )}
                {player.isHost && !isCurrent && (
                  <span className="text-[10px] uppercase tracking-wider text-slate-500">(host)</span>
                )}
                {isTurn && (
                  <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-amber-400"></span>
                )}
              </div>
              <span className={`text-sm font-semibold tabular-nums ${
                (player.score ?? 0) < 0 ? 'text-rose-400' : ''
              }`}>
                {(player.score ?? 0) < 0 ? '-' : ''}${Math.abs(player.score ?? 0)}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
