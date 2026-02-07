"use client";

import { useActionState } from "react";
import { joinRoom } from "../app/actions/rooms";

export default function JoinRoomForm() {
  const [state, formAction, isPending] = useActionState(joinRoom, {
    error: null,
  });

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Join room</h2>
        <p className="text-sm text-slate-300">
          Enter your name and the room code to jump into the action.
        </p>
      </div>
      <form action={formAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          Name
          <input
            type="text"
            name="playerName"
            placeholder="Alex"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
            required
          />
        </label>
        <label className="block text-sm font-medium text-slate-200">
          Room code
          <input
            type="text"
            name="roomCode"
            placeholder="QUIZ123"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
            required
          />
        </label>
        {state.error && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
            {state.error}
          </div>
        )}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {isPending ? "Joining..." : "Join room"}
        </button>
      </form>
    </div>
  );
}
