"use client";

import { useMemo, useState } from "react";
import ClueModal from "../../../components/ClueModal";
import JeopardyBoard from "../../../components/JeopardyBoard";
import Scoreboard from "../../../components/Scoreboard";
import StatusBadge from "../../../components/StatusBadge";
import type { Board, Clue, Player } from "../../../types/game";

interface GamePageProps {
  params: {
    code: string;
  };
}

const mockPlayers: Player[] = [
  { id: "p1", name: "Alex Chen", score: 1200 },
  { id: "p2", name: "Sam Rivera", score: 800 },
  { id: "p3", name: "Jordan Patel", score: 600 },
  { id: "p4", name: "Taylor Brooks", score: 400 },
];

const mockBoard: Board = {
  categories: [
    {
      id: "c1",
      title: "Classic Films",
      clues: [
        {
          id: "c1-1",
          categoryId: "c1",
          question: "This 1942 film pairs Humphrey Bogart with Ingrid Bergman.",
          answer: "Casablanca",
          value: 200,
          sourceSnippet: "Warner Bros. release, 1942.",
        },
        {
          id: "c1-2",
          categoryId: "c1",
          question: "Orson Welles directed and starred in this 1941 debut.",
          answer: "Citizen Kane",
          value: 400,
          sourceSnippet: "RKO Pictures, 1941.",
        },
        {
          id: "c1-3",
          categoryId: "c1",
          question: "This 1952 musical is set in Hollywood during the silent era.",
          answer: "Singin' in the Rain",
          value: 600,
          sourceSnippet: "MGM, 1952.",
        },
        {
          id: "c1-4",
          categoryId: "c1",
          question: "Audrey Hepburn stars as Holly Golightly in this 1961 film.",
          answer: "Breakfast at Tiffany's",
          value: 800,
          sourceSnippet: "Paramount Pictures, 1961.",
        },
        {
          id: "c1-5",
          categoryId: "c1",
          question: "James Stewart plays George Bailey in this 1946 holiday classic.",
          answer: "It's a Wonderful Life",
          value: 1000,
          sourceSnippet: "Liberty Films, 1946.",
        },
      ],
    },
    {
      id: "c2",
      title: "Science Bits",
      clues: [
        {
          id: "c2-1",
          categoryId: "c2",
          question: "The force that keeps planets in orbit.",
          answer: "Gravity",
          value: 200,
          sourceSnippet: "Newton's law of universal gravitation.",
        },
        {
          id: "c2-2",
          categoryId: "c2",
          question: "This particle carries a negative charge.",
          answer: "Electron",
          value: 400,
          sourceSnippet: "Subatomic particle in atoms.",
        },
        {
          id: "c2-3",
          categoryId: "c2",
          question: "The process by which plants make food using sunlight.",
          answer: "Photosynthesis",
          value: 600,
          sourceSnippet: "Occurs in chloroplasts.",
        },
        {
          id: "c2-4",
          categoryId: "c2",
          question: "H2O is the chemical formula for this substance.",
          answer: "Water",
          value: 800,
          sourceSnippet: "Two hydrogen, one oxygen.",
        },
        {
          id: "c2-5",
          categoryId: "c2",
          question: "The closest star to Earth.",
          answer: "The Sun",
          value: 1000,
          sourceSnippet: "A G-type main-sequence star.",
        },
      ],
    },
    {
      id: "c3",
      title: "World Capitals",
      clues: [
        {
          id: "c3-1",
          categoryId: "c3",
          question: "Capital of Canada.",
          answer: "Ottawa",
          value: 200,
          sourceSnippet: "Located in Ontario.",
        },
        {
          id: "c3-2",
          categoryId: "c3",
          question: "Capital of Japan.",
          answer: "Tokyo",
          value: 400,
          sourceSnippet: "Largest metro area in the world.",
        },
        {
          id: "c3-3",
          categoryId: "c3",
          question: "Capital of Brazil.",
          answer: "Brasilia",
          value: 600,
          sourceSnippet: "Purpose-built capital city.",
        },
        {
          id: "c3-4",
          categoryId: "c3",
          question: "Capital of Australia.",
          answer: "Canberra",
          value: 800,
          sourceSnippet: "Located in the ACT.",
        },
        {
          id: "c3-5",
          categoryId: "c3",
          question: "Capital of South Africa (executive).",
          answer: "Pretoria",
          value: 1000,
          sourceSnippet: "One of three capitals.",
        },
      ],
    },
    {
      id: "c4",
      title: "Pop Culture",
      clues: [
        {
          id: "c4-1",
          categoryId: "c4",
          question: "This series features the Stark family of Winterfell.",
          answer: "Game of Thrones",
          value: 200,
          sourceSnippet: "Based on George R. R. Martin novels.",
        },
        {
          id: "c4-2",
          categoryId: "c4",
          question: "Album that includes the hit single 'Bad Guy'.",
          answer: "When We All Fall Asleep, Where Do We Go?",
          value: 400,
          sourceSnippet: "Billie Eilish debut studio album.",
        },
        {
          id: "c4-3",
          categoryId: "c4",
          question: "Animated film featuring a talking snowman named Olaf.",
          answer: "Frozen",
          value: 600,
          sourceSnippet: "Disney, 2013.",
        },
        {
          id: "c4-4",
          categoryId: "c4",
          question: "Marvel hero with the shield.",
          answer: "Captain America",
          value: 800,
          sourceSnippet: "Steve Rogers.",
        },
        {
          id: "c4-5",
          categoryId: "c4",
          question: "This band sings 'Bohemian Rhapsody'.",
          answer: "Queen",
          value: 1000,
          sourceSnippet: "1975 single from A Night at the Opera.",
        },
      ],
    },
    {
      id: "c5",
      title: "Tech Founders",
      clues: [
        {
          id: "c5-1",
          categoryId: "c5",
          question: "Co-founder of Microsoft with Bill Gates.",
          answer: "Paul Allen",
          value: 200,
          sourceSnippet: "Founded Microsoft in 1975.",
        },
        {
          id: "c5-2",
          categoryId: "c5",
          question: "Apple co-founder known for product launches in a black turtleneck.",
          answer: "Steve Jobs",
          value: 400,
          sourceSnippet: "Returned to Apple in 1997.",
        },
        {
          id: "c5-3",
          categoryId: "c5",
          question: "Founder of SpaceX and Tesla.",
          answer: "Elon Musk",
          value: 600,
          sourceSnippet: "Also co-founded PayPal.",
        },
        {
          id: "c5-4",
          categoryId: "c5",
          question: "Co-founder of Google with Larry Page.",
          answer: "Sergey Brin",
          value: 800,
          sourceSnippet: "Met at Stanford.",
        },
        {
          id: "c5-5",
          categoryId: "c5",
          question: "Founder of Amazon.",
          answer: "Jeff Bezos",
          value: 1000,
          sourceSnippet: "Started Amazon in 1994.",
        },
      ],
    },
  ],
};

export default function GamePage({ params }: GamePageProps) {
  const [revealedClueIds, setRevealedClueIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [lastResult, setLastResult] = useState<{
    clue: Clue;
    isCorrect: boolean;
  } | null>(null);

  const board = useMemo(() => mockBoard, []);
  const currentPlayerId = "p2";

  const handleClueSelect = (clue: Clue) => {
    if (revealedClueIds.has(clue.id)) {
      return;
    }
    setSelectedClue(clue);
  };

  const handleSubmit = (answer: string, clue: Clue) => {
    const isCorrect = answer.trim().length > 0;
    setLastResult({ clue, isCorrect });
    setRevealedClueIds((prev) => {
      const next = new Set(prev);
      next.add(clue.id);
      return next;
    });
    setSelectedClue(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-10 text-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">
              Jeoparody
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-white md:text-3xl">
                Room {params.code}
              </h1>
              <StatusBadge label="Playing" />
            </div>
          </div>
          <div className="text-sm text-slate-300">
            Round 1 · Board live
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Scoreboard
            players={mockPlayers}
            currentPlayerId={currentPlayerId}
          />
          <div className="flex flex-col gap-6">
            {!board ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-300">
                Generating board...
              </div>
            ) : (
              <JeopardyBoard
                board={board}
                revealedClueIds={revealedClueIds}
                onClueSelect={handleClueSelect}
              />
            )}

            {lastResult ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                      lastResult.isCorrect
                        ? "bg-emerald-400/10 text-emerald-200"
                        : "bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    {lastResult.isCorrect ? "Correct" : "Wrong"}
                  </span>
                  <span className="text-sm text-slate-300">
                    Reveal answer for {lastResult.clue.value} points
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-sm font-semibold text-white">
                    Answer: {lastResult.clue.answer}
                  </p>
                  <p className="mt-2 text-xs text-slate-400">
                    {lastResult.clue.sourceSnippet}
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      </main>

      <ClueModal
        clue={selectedClue}
        isOpen={Boolean(selectedClue)}
        onClose={() => setSelectedClue(null)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
