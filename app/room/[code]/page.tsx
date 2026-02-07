"use client";

import { useState } from "react";
import HostControls from "../../../components/HostControls";
import PlayerList from "../../../components/PlayerList";
import StatusBadge from "../../../components/StatusBadge";
import type { Player } from "../../../types/game";

interface RoomPageProps {
  params: {
    code: string;
  };
}

const mockPlayers: Player[] = [
  { id: "p1", name: "Alex Chen", isHost: true },
  { id: "p2", name: "Sam Rivera" },
  { id: "p3", name: "Jordan Patel" },
  { id: "p4", name: "Taylor Brooks" },
];

export default function RoomPage({ params }: RoomPageProps) {
  const [copied, setCopied] = useState(false);
  const hasUploadedPdf = false;

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(params.code);
      } else {
        const temp = document.createElement("textarea");
        temp.value = params.code;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand("copy");
        temp.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
              Jeoparody
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-white md:text-3xl">
                Room {params.code}
              </h1>
              <StatusBadge label="Lobby" />
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-full border border-slate-700 bg-slate-950/60 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-amber-300 hover:text-amber-200"
          >
            {copied ? "Copied!" : "Copy Room Code"}
          </button>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <PlayerList players={mockPlayers} />
          <div className="flex flex-col gap-4">
            <HostControls
              canStart={hasUploadedPdf}
              onUpload={() => {}}
              onStart={() => {}}
            />
            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-300">
              <p className="font-semibold text-white">Next steps</p>
              <p className="mt-2 text-slate-300">
                Upload a trivia PDF to generate the board, then start the game
                when everyone is ready.
              </p>
            </div>
            {!hasUploadedPdf ? (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Waiting for host to upload a PDF.
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
