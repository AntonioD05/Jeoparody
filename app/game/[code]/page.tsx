"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ClueModal from "../../../components/ClueModal";
import JeopardyBoard from "../../../components/JeopardyBoard";
import Scoreboard from "../../../components/Scoreboard";
import StatusBadge from "../../../components/StatusBadge";
import { createClient } from "../../../utils/supabase/client";
import { selectClue, submitAnswer, continueGame, skipClue } from "../../actions/game";
import type { Board as RawBoard } from "../../../types/board-schema";
import type { Board, Clue, Player } from "../../../types/game";

interface GamePageProps {
  params: Promise<{
    code: string;
  }>;
}

type GamePhase = "selecting" | "answering" | "revealing" | "finished";

type LastResult = {
  clueId: string;
  playerId: string;
  playerName: string;
  isCorrect: boolean;
  pointsDelta: number;
  answer: string;
};

type GameState = {
  phase: GamePhase;
  turnPlayerId: string | null;
  revealedIds: string[];
  selectedClueId: string | null;
  lastResult: LastResult | null;
};

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const { code } = use(params);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  
  // Game state from database
  const [gameState, setGameState] = useState<GameState>({
    phase: "selecting",
    turnPlayerId: null,
    revealedIds: [],
    selectedClueId: null,
    lastResult: null,
  });

  // For the ClueModal
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizeBoard = useCallback((raw: RawBoard): Board => {
    return {
      categories: raw.categories.map((category, categoryIndex) => {
        const categoryId = `cat-${categoryIndex + 1}`;
        return {
          id: categoryId,
          title: category.title,
          clues: category.clues.map((clue) => ({
            id: clue.id,
            value: clue.value,
            question: clue.question,
            answer: clue.answer,
            categoryId,
            sourceSnippet: clue.source_snippet,
          })),
        };
      }),
    };
  }, []);

  // Load initial data
  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;

    async function loadInitialData() {
      setIsLoadingBoard(true);
      setBoardError(null);

      // Get current player ID
      const playerRes = await fetch(`/api/current-player?roomCode=${code}`);
      if (playerRes.ok) {
        const { playerId } = await playerRes.json();
        if (isMounted) setCurrentPlayerId(playerId);
      }

      // Get room
      const { data: room, error: roomError } = await supabase
        .from("rooms")
        .select("id, host_id, status")
        .eq("code", code)
        .single();

      if (roomError || !room) {
        if (isMounted) {
          setBoardError("Room not found.");
          setIsLoadingBoard(false);
        }
        return;
      }

      if (room.status === "lobby") {
        router.push(`/room/${code}`);
        return;
      }

      if (isMounted) {
        setRoomId(room.id);
        setHostId(room.host_id);
      }

      // Get game
      const { data: game, error: gameError } = await supabase
        .from("games")
        .select("board_json, phase, turn_player_id, revealed_ids, selected_clue_id, last_result")
        .eq("room_id", room.id)
        .single();

      if (gameError || !game?.board_json) {
        if (isMounted) {
          setBoardError("Board not ready yet.");
          setIsLoadingBoard(false);
        }
        return;
      }

      if (isMounted) {
        setBoard(normalizeBoard(game.board_json as RawBoard));
        setGameState({
          phase: (game.phase as GamePhase) ?? "selecting",
          turnPlayerId: game.turn_player_id,
          revealedIds: (game.revealed_ids as string[]) ?? [],
          selectedClueId: game.selected_clue_id,
          lastResult: game.last_result as LastResult | null,
        });
        setIsLoadingBoard(false);
      }

      // Get players
      const { data: playersData } = await supabase
        .from("players")
        .select("id, name, score")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true });

      if (playersData && isMounted) {
        setPlayers(
          playersData.map((p) => ({
            id: p.id,
            name: p.name,
            score: p.score ?? 0,
            isHost: p.id === room.host_id,
          }))
        );
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [code, normalizeBoard, router]);

  // Subscribe to game state changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`game-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "games",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newGame = payload.new as {
            phase?: string;
            turn_player_id?: string | null;
            revealed_ids?: string[];
            selected_clue_id?: string | null;
            last_result?: LastResult | null;
          };

          setGameState((prev) => ({
            phase: (newGame.phase as GamePhase) ?? prev.phase,
            turnPlayerId: newGame.turn_player_id ?? prev.turnPlayerId,
            revealedIds: newGame.revealed_ids ?? prev.revealedIds,
            selectedClueId: newGame.selected_clue_id ?? prev.selectedClueId,
            lastResult: newGame.last_result ?? prev.lastResult,
          }));

          // If we're in answering phase, show the clue modal for all players
          if (newGame.phase === "answering" && newGame.selected_clue_id && board) {
            const clueId = newGame.selected_clue_id;
            const foundClue = board.categories
              .flatMap((cat) => cat.clues)
              .find((c) => c.id === clueId);
            if (foundClue) {
              setSelectedClue(foundClue);
            }
          }

          // Clear selected clue when phase changes away from answering
          if (newGame.phase !== "answering") {
            setSelectedClue(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, board]);

  // Subscribe to player changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`game-${roomId}-players`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Refetch all players
          const { data: playersData } = await supabase
            .from("players")
            .select("id, name, score")
            .eq("room_id", roomId)
            .order("joined_at", { ascending: true });

          if (playersData) {
            setPlayers(
              playersData.map((p) => ({
                id: p.id,
                name: p.name,
                score: p.score ?? 0,
                isHost: p.id === hostId,
              }))
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, hostId]);

  // Subscribe to room status changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`game-${roomId}-room`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const status = (payload.new as { status?: string })?.status;
          if (status === "lobby") {
            router.push(`/room/${code}`);
          } else if (status === "finished") {
            // Game over
            setGameState((prev) => ({ ...prev, phase: "finished" }));
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          router.push("/");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, router, code]);

  const handleClueSelect = async (clue: Clue) => {
    if (gameState.revealedIds.includes(clue.id)) {
      return;
    }

    if (gameState.phase !== "selecting") {
      setActionError("Wait for the current clue to be resolved");
      return;
    }

    if (gameState.turnPlayerId !== currentPlayerId) {
      setActionError("It's not your turn to pick");
      return;
    }

    setActionError(null);
    setIsSubmitting(true);

    const result = await selectClue(code, clue.id);

    if (result.error) {
      setActionError(result.error);
    } else {
      // Update local state immediately so modal opens without waiting for realtime
      setSelectedClue(clue);
      setGameState((prev) => ({
        ...prev,
        phase: "answering",
        selectedClueId: clue.id,
      }));
    }

    setIsSubmitting(false);
  };

  const handleSubmitAnswer = async (answer: string, clue: Clue) => {
    setActionError(null);
    setIsSubmitting(true);

    // For now, simple matching (host will need to judge in a real game)
    const correctAnswer = clue.answer.toLowerCase().trim();
    const playerAnswer = answer.toLowerCase().trim();
    const isCorrect = playerAnswer.includes(correctAnswer) || correctAnswer.includes(playerAnswer);

    const result = await submitAnswer(code, answer, isCorrect);

    if (result.error) {
      setActionError(result.error);
    }

    setIsSubmitting(false);
    setSelectedClue(null);
  };

  const handleContinue = async () => {
    setActionError(null);
    setIsSubmitting(true);

    const result = await continueGame(code);

    if (result.error) {
      setActionError(result.error);
    }

    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    setActionError(null);
    setIsSubmitting(true);

    const result = await skipClue(code);

    if (result.error) {
      setActionError(result.error);
    }

    setIsSubmitting(false);
    setSelectedClue(null);
  };

  // Find the turn player's name
  const turnPlayer = players.find((p) => p.id === gameState.turnPlayerId);
  const isMyTurn = currentPlayerId === gameState.turnPlayerId;
  const isHost = currentPlayerId === hostId;

  // Get the selected clue details
  const getSelectedClueDetails = (): Clue | null => {
    if (!gameState.selectedClueId || !board) return null;
    for (const category of board.categories) {
      for (const clue of category.clues) {
        if (clue.id === gameState.selectedClueId) {
          return clue;
        }
      }
    }
    return null;
  };

  const selectedClueDetails = getSelectedClueDetails();

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
                Room {code}
              </h1>
              <StatusBadge 
                label={gameState.phase === "finished" ? "Game Over" : "Playing"} 
              />
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 text-sm text-slate-300">
            <span>
              {gameState.phase === "selecting" && turnPlayer && (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400"></span>
                  {isMyTurn ? "Your turn to pick!" : `${turnPlayer.name}'s turn to pick`}
                </span>
              )}
              {gameState.phase === "answering" && turnPlayer && (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400"></span>
                  {isMyTurn ? "Your turn to answer!" : `${turnPlayer.name}'s turn to answer`}
                </span>
              )}
              {gameState.phase === "revealing" && "Answer revealed"}
              {gameState.phase === "finished" && "Game complete!"}
            </span>
            <span className="text-xs text-slate-500">
              {gameState.revealedIds.length} / {board ? board.categories.length * 5 : 25} clues revealed
            </span>
          </div>
        </header>

        {actionError && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {actionError}
          </div>
        )}

        <section className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <Scoreboard
            players={players}
            currentPlayerId={currentPlayerId}
            turnPlayerId={gameState.turnPlayerId}
          />
          <div className="flex flex-col gap-6">
            {!board ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-6 text-sm text-slate-300">
                {isLoadingBoard
                  ? "Loading board..."
                  : boardError ?? "Loading board..."}
              </div>
            ) : (
              <JeopardyBoard
                board={board}
                revealedClueIds={new Set(gameState.revealedIds)}
                onClueSelect={handleClueSelect}
                selectedClueId={gameState.selectedClueId}
                canSelect={gameState.phase === "selecting" && isMyTurn && !isSubmitting}
              />
            )}

            {/* Result display */}
            {gameState.phase === "revealing" && gameState.lastResult && selectedClueDetails && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${
                      gameState.lastResult.isCorrect
                        ? "bg-emerald-400/10 text-emerald-200"
                        : "bg-rose-400/10 text-rose-200"
                    }`}
                  >
                    {gameState.lastResult.isCorrect ? "Correct" : "Wrong"}
                  </span>
                  <span className="text-sm text-slate-300">
                    {gameState.lastResult.playerName} answered for {selectedClueDetails.value} points
                    {gameState.lastResult.isCorrect 
                      ? ` (+${gameState.lastResult.pointsDelta})` 
                      : ` (${gameState.lastResult.pointsDelta})`
                    }
                  </span>
                </div>
                <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Question</p>
                  <p className="text-sm text-slate-200 mb-4">{selectedClueDetails.question}</p>
                  <p className="text-xs text-slate-400 uppercase tracking-wide mb-2">Answer</p>
                  <p className="text-sm font-semibold text-white">
                    {selectedClueDetails.answer}
                  </p>
                  {selectedClueDetails.sourceSnippet && (
                    <p className="mt-2 text-xs text-slate-400">
                      {selectedClueDetails.sourceSnippet}
                    </p>
                  )}
                </div>
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleContinue}
                    disabled={isSubmitting}
                    className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-amber-50 disabled:opacity-50"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {/* Game over display */}
            {gameState.phase === "finished" && (
              <div className="rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-400/10 to-transparent p-8 text-center">
                <h2 className="text-2xl font-bold text-amber-100">Game Over!</h2>
                <p className="mt-2 text-slate-300">
                  {players.length > 0 && (
                    <>
                      Winner: <span className="font-semibold text-white">
                        {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name}
                      </span> with {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.score ?? 0} points!
                    </>
                  )}
                </p>
                <button
                  onClick={() => router.push("/")}
                  className="mt-6 rounded-full border border-amber-400/50 bg-amber-400/10 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200 transition hover:bg-amber-400/20"
                >
                  Back to Home
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Clue Modal for answering - only turn player can answer */}
      <ClueModal
        clue={selectedClue}
        isOpen={Boolean(selectedClue) && gameState.phase === "answering"}
        onClose={() => {
          // Only host can close/skip during answering
          if (isHost) {
            handleSkip();
          }
        }}
        onSubmit={handleSubmitAnswer}
        isSubmitting={isSubmitting}
        canSkip={isHost}
        onSkip={handleSkip}
        canAnswer={isMyTurn}
      />
    </div>
  );
}
