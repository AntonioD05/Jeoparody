"use client";

import { useActionState } from "react";
import { createRoom } from "../app/actions/rooms";

export default function CreateRoomForm() {
  const [state, formAction, isPending] = useActionState(createRoom, {
    error: null,
  });

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Create room</h2>
        <p className="text-sm text-slate-300">
          Start a fresh game session and invite friends with a shareable
          code.
        </p>
      </div>
      <form action={formAction} className="mt-6 space-y-4">
        <label className="block text-sm font-medium text-slate-200">
          Your name
          <input
            type="text"
            name="hostName"
            placeholder="Alex"
            className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
            required
            disabled={isPending}
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
          className="inline-flex w-full items-center justify-center rounded-full bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Creating..." : "Create a room"}
        </button>
      </form>
    </div>
  );
}
