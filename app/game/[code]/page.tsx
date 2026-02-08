"use client";

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import ClueModal from "../../../components/ClueModal";
import FinalJeopardyModal from "../../../components/FinalJeopardyModal";
import JeopardyBoard from "../../../components/JeopardyBoard";
import Scoreboard from "../../../components/Scoreboard";
import StatusBadge from "../../../components/StatusBadge";
import { createClient } from "../../../utils/supabase/client";
import { 
  selectClue, 
  submitAnswer, 
  continueGame, 
  skipClue, 
  cleanupFinishedGame,
  leaveGame,
  submitFinalWager,
  submitFinalAnswer,
  revealFinalResults,
} from "../../actions/game";
import type { FinalJeopardyWager } from "../../actions/game";
import { useVoiceover } from "../../../hooks/useVoiceover";
import type { Board as RawBoard, FinalJeopardy as RawFinalJeopardy } from "../../../types/board-schema";
import type { Board, Clue, Player, FinalJeopardy } from "../../../types/game";

interface GamePageProps {
  params: Promise<{
    code: string;
  }>;
}

type GamePhase = "selecting" | "answering" | "revealing" | "final_wager" | "final_answering" | "final_revealing" | "finished";

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
  finalWagers: FinalJeopardyWager[];
};

export default function GamePage({ params }: GamePageProps) {
  const router = useRouter();
  const { code } = use(params);
  
  const [players, setPlayers] = useState<Player[]>([]);
  const [board, setBoard] = useState<Board | null>(null);
  const [finalJeopardy, setFinalJeopardy] = useState<FinalJeopardy | null>(null);
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
    finalWagers: [],
  });


  // For the ClueModal
  const [selectedClue, setSelectedClue] = useState<Clue | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  
  // Voiceover for result announcements
  const { speak: speakResult, stop: stopResult, isLoading: isResultLoading, isPlaying: isResultPlaying } = useVoiceover();
  const lastAnnouncedClueId = useRef<string | null>(null);
  
  // Mute state for announcer
  const [isMuted, setIsMuted] = useState(false);

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

  const normalizeFinalJeopardy = useCallback((raw: RawFinalJeopardy): FinalJeopardy => {
    return {
      category: raw.category,
      question: raw.question,
      answer: raw.answer,
      sourceSnippet: raw.source_snippet,
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
        .select("board_json, phase, turn_player_id, revealed_ids, selected_clue_id, last_result, final_wagers")
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
        const rawBoard = game.board_json as RawBoard & { final_jeopardy?: RawFinalJeopardy };
        setBoard(normalizeBoard(rawBoard));
        if (rawBoard.final_jeopardy) {
          setFinalJeopardy(normalizeFinalJeopardy(rawBoard.final_jeopardy));
        }
        setGameState({
          phase: (game.phase as GamePhase) ?? "selecting",
          turnPlayerId: game.turn_player_id,
          revealedIds: (game.revealed_ids as string[]) ?? [],
          selectedClueId: game.selected_clue_id,
          lastResult: game.last_result as LastResult | null,
          finalWagers: (game.final_wagers as FinalJeopardyWager[]) ?? [],
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
  }, [code, normalizeBoard, normalizeFinalJeopardy, router]);

  // Subscribe to game state changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    // Helper to refetch full game state
    const refetchGameState = async () => {
      const { data: game } = await supabase
        .from("games")
        .select("board_json, phase, turn_player_id, revealed_ids, selected_clue_id, last_result, final_wagers")
        .eq("room_id", roomId)
        .single();

      if (game) {
        const newPhase = (game.phase as GamePhase) ?? "selecting";
        const newSelectedClueId = game.selected_clue_id;
        
        setGameState({
          phase: newPhase,
          turnPlayerId: game.turn_player_id,
          revealedIds: (game.revealed_ids as string[]) ?? [],
          selectedClueId: newSelectedClueId,
          lastResult: game.last_result as LastResult | null,
          finalWagers: (game.final_wagers as FinalJeopardyWager[]) ?? [],
        });

        // Update Final Jeopardy if not already set
        if (game.board_json) {
          const rawBoard = game.board_json as RawBoard & { final_jeopardy?: RawFinalJeopardy };
          if (rawBoard.final_jeopardy && !finalJeopardy) {
            setFinalJeopardy(normalizeFinalJeopardy(rawBoard.final_jeopardy));
          }
        }

        // Update modal state based on phase - use board from game if local board not ready
        const currentBoard = board ?? (game.board_json ? normalizeBoard(game.board_json as RawBoard) : null);
        
        if (newPhase === "answering" && newSelectedClueId && currentBoard) {
          const foundClue = currentBoard.categories
            .flatMap((cat) => cat.clues)
            .find((c) => c.id === newSelectedClueId);
          if (foundClue) {
            setSelectedClue(foundClue);
          }
        } else if (newPhase !== "answering") {
          setSelectedClue(null);
        }
      }
    };

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
        () => {
          // Always refetch on any game update to ensure we have the latest state
          refetchGameState();
        }
      )
      .subscribe((status) => {
        // Refetch when subscription is established to ensure we have latest state
        if (status === "SUBSCRIBED") {
          refetchGameState();
        }
      });

    // Also poll periodically as a fallback for reliability
    const pollInterval = setInterval(refetchGameState, 2000);

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId, board, normalizeBoard, normalizeFinalJeopardy, finalJeopardy]);

  // Subscribe to player changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const refetchPlayers = async () => {
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
    };

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
        () => {
          // Refetch all players on any change
          refetchPlayers();
        }
      )
      .subscribe((status) => {
        // Also refetch when subscription is established
        if (status === "SUBSCRIBED") {
          refetchPlayers();
        }
      });

    // Poll players periodically as fallback
    const pollInterval = setInterval(refetchPlayers, 2000);

    return () => {
      clearInterval(pollInterval);
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

  // Announce result with voiceover when revealing phase starts
  useEffect(() => {
    if (gameState.phase !== "revealing" || !gameState.lastResult || !board || isMuted) {
      return;
    }

    // Avoid re-announcing the same clue
    if (lastAnnouncedClueId.current === gameState.lastResult.clueId) {
      return;
    }
    lastAnnouncedClueId.current = gameState.lastResult.clueId;

    // Find the clue details
    const clue = board.categories
      .flatMap((cat) => cat.clues)
      .find((c) => c.id === gameState.lastResult?.clueId);

    if (!clue) return;

    // Build the announcement
    const correctness = gameState.lastResult.isCorrect
      ? "Correct!"
      : "Incorrect.";
    const answerPart = `The answer is: ${clue.answer}.`;
    const explanationPart = clue.sourceSnippet ? clue.sourceSnippet : "";

    const announcement = [correctness, answerPart, explanationPart]
      .filter(Boolean)
      .join(" ");

    speakResult(announcement);
  }, [gameState.phase, gameState.lastResult, board, speakResult, isMuted]);

  // Announce the winner when game finishes
  const hasAnnouncedWinner = useRef(false);
  useEffect(() => {
    if (gameState.phase !== "finished" || players.length === 0 || isMuted) {
      return;
    }

    if (hasAnnouncedWinner.current) {
      return;
    }
    hasAnnouncedWinner.current = true;

    const sortedPlayers = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const winner = sortedPlayers[0];

    if (winner) {
      const announcement = `Game over! The winner is ${winner.name} with ${winner.score ?? 0} points. Congratulations!`;
      speakResult(announcement);
    }
  }, [gameState.phase, players, speakResult, isMuted]);

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
    } else {
      // Optimistically update local state
      const pointsDelta = isCorrect ? clue.value : -clue.value;
      
      setGameState((prev) => ({
        ...prev,
        phase: "revealing",
        revealedIds: [...prev.revealedIds, clue.id],
        lastResult: {
          clueId: clue.id,
          playerId: currentPlayerId!,
          playerName: players.find((p) => p.id === currentPlayerId)?.name ?? "You",
          isCorrect,
          pointsDelta,
          answer,
        },
      }));

      // Update player scores locally
      setPlayers((prev) =>
        prev.map((p) =>
          p.id === currentPlayerId
            ? { ...p, score: (p.score ?? 0) + pointsDelta }
            : p
        )
      );
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
    } else {
      // Optimistically update local state
      const lastResult = gameState.lastResult;
      let nextTurnPlayerId = gameState.turnPlayerId;

      if (lastResult?.isCorrect) {
        // Correct answer: same player picks again
        nextTurnPlayerId = gameState.turnPlayerId;
      } else {
        // Wrong answer: rotate to next player
        const currentIndex = players.findIndex((p) => p.id === gameState.turnPlayerId);
        const nextIndex = (currentIndex + 1) % players.length;
        nextTurnPlayerId = players[nextIndex]?.id ?? gameState.turnPlayerId;
      }

      setGameState((prev) => ({
        ...prev,
        phase: "selecting",
        selectedClueId: null,
        turnPlayerId: nextTurnPlayerId,
      }));
    }

    setIsSubmitting(false);
  };

  const handleSkip = async () => {
    setActionError(null);
    setIsSubmitting(true);

    const result = await skipClue(code);

    if (result.error) {
      setActionError(result.error);
    } else {
      // Optimistically update local state
      setGameState((prev) => ({
        ...prev,
        phase: "revealing",
        revealedIds: prev.selectedClueId 
          ? [...prev.revealedIds, prev.selectedClueId]
          : prev.revealedIds,
        lastResult: {
          clueId: prev.selectedClueId ?? "",
          playerId: currentPlayerId!,
          playerName: "No one",
          isCorrect: false,
          pointsDelta: 0,
          answer: "(skipped)",
        },
      }));
    }

    setIsSubmitting(false);
    setSelectedClue(null);
  };

  // Final Jeopardy handlers
  const handleFinalWager = async (wager: number) => {
    setActionError(null);
    setIsSubmitting(true);

    const result = await submitFinalWager(code, wager);

    if (result.error) {
      setActionError(result.error);
    }

    setIsSubmitting(false);
  };

  const handleFinalAnswer = async (answer: string) => {
    setActionError(null);
    setIsSubmitting(true);

    const result = await submitFinalAnswer(code, answer);

    if (result.error) {
      setActionError(result.error);
    }

    setIsSubmitting(false);
  };

  const handleRevealFinalResults = async () => {
    setActionError(null);
    setIsSubmitting(true);

    const result = await revealFinalResults(code);

    if (result.error) {
      setActionError(result.error);
    }

    setIsSubmitting(false);
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
                label={
                  gameState.phase === "finished" 
                    ? "Game Over" 
                    : gameState.phase.startsWith("final_") 
                      ? "Final Jeopardy" 
                      : "Playing"
                } 
              />
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  if (!isMuted) {
                    stopResult();
                  }
                }}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                  isMuted
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20"
                    : "border-slate-700 bg-slate-800/50 text-slate-300 hover:border-amber-400/50 hover:text-amber-200"
                }`}
                title={isMuted ? "Unmute announcer" : "Mute announcer"}
              >
                {isMuted ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 001.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 00-1.06-1.06l-1.72 1.72-1.72-1.72z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                    <path d="M15.932 7.757a.75.75 0 011.061 0 6 6 0 010 8.486.75.75 0 01-1.06-1.061 4.5 4.5 0 000-6.364.75.75 0 010-1.06z" />
                  </svg>
                )}
                {isMuted ? "Muted" : "Sound"}
              </button>
              <button
                onClick={async () => {
                  await leaveGame(code);
                  router.push("/");
                }}
                className="flex items-center gap-1.5 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] text-slate-300 transition hover:border-rose-400 hover:text-rose-200"
                title="Leave game"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                </svg>
                Exit
              </button>
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
              {gameState.phase === "final_wager" && (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400"></span>
                  Final Jeopardy - Place your wagers!
                </span>
              )}
              {gameState.phase === "final_answering" && (
                <span className="flex items-center gap-2">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400"></span>
                  Final Jeopardy - Submit your answers!
                </span>
              )}
              {gameState.phase === "final_revealing" && "Final Jeopardy - Results"}
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

          </div>
        </section>
      </main>

      {/* Result Modal - shows after answering */}
      {gameState.phase === "revealing" && gameState.lastResult && selectedClueDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-2xl rounded-3xl border border-slate-800 bg-slate-950 p-8 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] ${
                    gameState.lastResult.isCorrect
                      ? "bg-emerald-400/20 text-emerald-200"
                      : "bg-rose-400/20 text-rose-200"
                  }`}
                >
                  {gameState.lastResult.isCorrect ? "Correct!" : "Wrong"}
                </span>
                {(isResultLoading || isResultPlaying) && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                    </span>
                    {isResultLoading ? "Loading..." : "Speaking"}
                  </span>
                )}
              </div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                {selectedClueDetails.value} points
              </p>
            </div>
            
            <div className="mt-4 text-sm text-slate-300">
              {gameState.lastResult.playerName} answered
              {gameState.lastResult.isCorrect 
                ? <span className="text-emerald-300"> (+${gameState.lastResult.pointsDelta})</span>
                : <span className="text-rose-300"> (${gameState.lastResult.pointsDelta})</span>
              }
            </div>

            <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 mb-2">Question</p>
              <p className="text-lg text-white">{selectedClueDetails.question}</p>
            </div>

            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300 mb-2">Answer</p>
              <p className="text-lg font-semibold text-emerald-100">
                {selectedClueDetails.answer}
              </p>
              {selectedClueDetails.sourceSnippet && (
                <p className="mt-3 text-xs text-slate-400">
                  {selectedClueDetails.sourceSnippet}
                </p>
              )}
            </div>

            <button
              onClick={handleContinue}
              disabled={isSubmitting || !isMyTurn}
              className="mt-6 w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-amber-50 disabled:opacity-50"
            >
              {isSubmitting ? "Loading..." : !isMyTurn ? "Waiting for current player..." : "Continue"}
            </button>
          </div>
        </div>
      )}

      {/* Clue Modal for answering - only turn player can answer */}
      <ClueModal
        clue={selectedClue}
        isOpen={Boolean(selectedClue) && gameState.phase === "answering"}
        onClose={() => {
          // Only current player can close/skip during answering
          if (isMyTurn) {
            handleSkip();
          }
        }}
        onSubmit={handleSubmitAnswer}
        isSubmitting={isSubmitting}
        canSkip={isMyTurn}
        onSkip={handleSkip}
        canAnswer={isMyTurn}
        isMuted={isMuted}
      />

      {/* Final Jeopardy Modal */}
      {(gameState.phase === "final_wager" || 
        gameState.phase === "final_answering" || 
        gameState.phase === "final_revealing") && (
        <FinalJeopardyModal
          finalJeopardy={finalJeopardy}
          phase={
            gameState.phase === "final_wager" 
              ? "wager" 
              : gameState.phase === "final_answering" 
                ? "answering" 
                : "revealing"
          }
          currentPlayerId={currentPlayerId}
          players={players}
          wagers={gameState.finalWagers}
          onSubmitWager={handleFinalWager}
          onSubmitAnswer={handleFinalAnswer}
          onRevealResults={handleRevealFinalResults}
          isSubmitting={isSubmitting}
          isMuted={isMuted}
        />
      )}

      {/* Winner Modal - Game Over */}
      {gameState.phase === "finished" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-10">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" />
          <div className="relative w-full max-w-lg rounded-3xl border border-amber-400/30 bg-slate-950 p-8 text-slate-100 shadow-2xl">
            <div className="flex flex-col items-center text-center">
              <div className="flex items-center justify-center gap-3">
                <h2 className="text-3xl font-bold text-amber-100">🎉 Game Over!</h2>
                {(isResultLoading || isResultPlaying) && (
                  <span className="flex items-center gap-1.5 text-xs text-amber-400">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500"></span>
                    </span>
                    {isResultLoading ? "Loading..." : "Speaking"}
                  </span>
                )}
              </div>
              <p className="mt-4 text-lg text-slate-300">
                {players.length > 0 && (
                  <>
                    Winner: <span className="font-semibold text-white">
                      {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.name}
                    </span> with {[...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]?.score ?? 0} points!
                  </>
                )}
              </p>
              <button
                onClick={async () => {
                  await cleanupFinishedGame(code);
                  router.push("/");
                }}
                className="mt-8 rounded-full border border-amber-400/50 bg-amber-400/10 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200 transition hover:bg-amber-400/20"
              >
                Back to Home
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
