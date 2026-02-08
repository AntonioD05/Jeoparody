"use client";

import type { Player } from "../types/game";

type PlayerListProps = {
  players: Player[];
  currentPlayerId?: string | null;
};

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  if (players.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-sm text-slate-300">
        No players yet.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-white">Players</h2>
      <ul className="mt-4 space-y-3 text-sm">
        {players.map((player) => {
          const isCurrentPlayer = player.id === currentPlayerId;
          return (
            <li
              key={player.id}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                isCurrentPlayer
                  ? "border-amber-400/50 bg-amber-400/10 text-amber-100"
                  : "border-slate-800/60 bg-slate-950/40 text-slate-100"
              }`}
            >
              <span className="flex items-center gap-2 font-medium">
                {player.name}
                {isCurrentPlayer && (
                  <span className="text-[10px] uppercase tracking-wider text-amber-300">(you)</span>
                )}
              </span>
              {player.isHost ? (
                <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                  Host
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
