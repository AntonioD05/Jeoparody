"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      return;
    }
    router.push(`/room/${encodeURIComponent(trimmedCode)}`);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-12">
        <header className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
            Jeoparody
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Host and join trivia rooms in seconds.
          </h1>
          <p className="mx-auto max-w-2xl text-base text-slate-300 sm:text-lg">
            Spin up a new game or jump into an existing room. No downloads, no
            hassle, just play.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold">Create room</h2>
              <p className="text-sm text-slate-300">
                Start a fresh game session and invite friends with a shareable
                code.
              </p>
            </div>
            <Link
              href="/room/new"
              className="mt-6 inline-flex items-center justify-center rounded-full bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
            >
              Create a room
            </Link>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40">
            <div className="space-y-3">
              <h2 className="text-2xl font-semibold">Join room</h2>
              <p className="text-sm text-slate-300">
                Enter your name and the room code to jump into the action.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Name
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Alex"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
                  required
                />
              </label>
              <label className="block text-sm font-medium text-slate-200">
                Room code
                <input
                  type="text"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="QUIZ123"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
                  required
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
              >
                Join room
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
}
