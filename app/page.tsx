import { createRoom } from "./actions/rooms";
import JoinRoomForm from "../components/JoinRoomForm";

export default function Home() {
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
            <form action={createRoom} className="mt-6 space-y-4">
              <label className="block text-sm font-medium text-slate-200">
                Your name
                <input
                  type="text"
                  name="hostName"
                  placeholder="Alex"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-500/40"
                  required
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-white"
              >
                Create a room
              </button>
            </form>
          </div>

          <JoinRoomForm />
        </section>
      </main>
    </div>
  );
}
