"use client";

import type { Player } from "../types/game";

type PlayerListProps = {
  players: Player[];
};

export default function PlayerList({ players }: PlayerListProps) {
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
        {players.map((player) => (
          <li
            key={player.id}
            className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 px-4 py-3 text-slate-100"
          >
            <span className="font-medium">{player.name}</span>
            {player.isHost ? (
              <span className="rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
                Host
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
