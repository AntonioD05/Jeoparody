interface GamePageProps {
  params: {
    code: string;
  };
}

export default function GamePage({ params }: GamePageProps) {
  return (
    <div className="min-h-screen bg-slate-950 px-6 py-16 text-white">
      <main className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-semibold">Game: {params.code}</h1>
      </main>
    </div>
  );
}
