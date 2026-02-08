import CreateRoomForm from "../components/CreateRoomForm";
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
          <CreateRoomForm />

          <JoinRoomForm />
        </section>
      </main>
    </div>
  );
}
