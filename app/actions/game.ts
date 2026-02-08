"use server";

import { createClient } from "../../utils/supabase/server";
import { cookies } from "next/headers";

export type GamePhase = "selecting" | "answering" | "revealing" | "finished";

export type LastResult = {
  clueId: string;
  playerId: string;
  playerName: string;
  isCorrect: boolean;
  pointsDelta: number;
  answer: string;
};

export type GameState = {
  roomId: string;
  boardJson: unknown;
  phase: GamePhase;
  turnPlayerId: string | null;
  revealedIds: string[];
  selectedClueId: string | null;
  lastResult: LastResult | null;
};

/**
 * Get current player ID from cookie for a given room code
 */
async function getCurrentPlayerId(roomCode: string): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(`player_${roomCode}`)?.value ?? null;
}

/**
 * Select a clue - only the turn player can do this during "selecting" phase
 */
export async function selectClue(
  roomCode: string,
  clueId: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const currentPlayerId = await getCurrentPlayerId(roomCode);

  if (!currentPlayerId) {
    return { error: "You are not in this game" };
  }

  // Get room and game state
  const { data: room } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", roomCode)
    .single();

  if (!room) {
    return { error: "Room not found" };
  }

  if (room.status !== "playing") {
    return { error: "Game is not in progress" };
  }

  const { data: game } = await supabase
    .from("games")
    .select("phase, turn_player_id, revealed_ids")
    .eq("room_id", room.id)
    .single();

  if (!game) {
    return { error: "Game not found" };
  }

  if (game.phase !== "selecting") {
    return { error: "Cannot select a clue right now" };
  }

  if (game.turn_player_id !== currentPlayerId) {
    return { error: "It's not your turn" };
  }

  const revealedIds = (game.revealed_ids as string[]) ?? [];
  if (revealedIds.includes(clueId)) {
    return { error: "This clue has already been revealed" };
  }

  // Update game state to answering phase
  const { error: updateError } = await supabase
    .from("games")
    .update({
      phase: "answering",
      selected_clue_id: clueId,
    })
    .eq("room_id", room.id);

  if (updateError) {
    return { error: "Failed to select clue" };
  }

  return { error: null };
}

/**
 * Submit an answer - only the turn player can answer
 */
export async function submitAnswer(
  roomCode: string,
  answer: string,
  isCorrect: boolean
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const currentPlayerId = await getCurrentPlayerId(roomCode);

  if (!currentPlayerId) {
    return { error: "You are not in this game" };
  }

  // Get room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("code", roomCode)
    .single();

  if (!room) {
    return { error: "Room not found" };
  }

  // Get game and board
  const { data: game } = await supabase
    .from("games")
    .select("phase, selected_clue_id, board_json, revealed_ids, turn_player_id")
    .eq("room_id", room.id)
    .single();

  if (!game) {
    return { error: "Game not found" };
  }

  if (game.phase !== "answering") {
    return { error: "Cannot submit an answer right now" };
  }

  if (game.turn_player_id !== currentPlayerId) {
    return { error: "It's not your turn to answer" };
  }

  if (!game.selected_clue_id) {
    return { error: "No clue selected" };
  }

  // Find the clue value from board
  const board = game.board_json as {
    categories: Array<{
      clues: Array<{ id: string; value: number }>;
    }>;
  };

  let clueValue = 0;
  for (const category of board.categories) {
    for (const clue of category.clues) {
      if (clue.id === game.selected_clue_id) {
        clueValue = clue.value;
        break;
      }
    }
  }

  // Get answering player's name
  const { data: player } = await supabase
    .from("players")
    .select("name, score")
    .eq("id", currentPlayerId)
    .single();

  if (!player) {
    return { error: "Player not found" };
  }

  // Calculate points
  const pointsDelta = isCorrect ? clueValue : -clueValue;
  const newScore = (player.score ?? 0) + pointsDelta;

  // Update player score
  const { error: scoreError } = await supabase
    .from("players")
    .update({ score: newScore })
    .eq("id", currentPlayerId);

  if (scoreError) {
    return { error: "Failed to update score" };
  }

  // Add clue to revealed list
  const revealedIds = [...((game.revealed_ids as string[]) ?? []), game.selected_clue_id];

  // Check if game is finished (all clues revealed)
  const totalClues = board.categories.reduce(
    (sum, cat) => sum + cat.clues.length,
    0
  );
  const isFinished = revealedIds.length >= totalClues;

  // Create last result record
  const lastResult: LastResult = {
    clueId: game.selected_clue_id,
    playerId: currentPlayerId,
    playerName: player.name,
    isCorrect,
    pointsDelta,
    answer,
  };

  // Update game state
  const { error: updateError } = await supabase
    .from("games")
    .update({
      phase: isFinished ? "finished" : "revealing",
      revealed_ids: revealedIds,
      last_result: lastResult,
    })
    .eq("room_id", room.id);

  if (updateError) {
    return { error: "Failed to update game state" };
  }

  // If game is finished, also update room status
  if (isFinished) {
    await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", room.id);
  }

  return { error: null };
}

/**
 * Continue to next clue selection after revealing answer
 * Only the turn player can advance
 */
export async function continueGame(
  roomCode: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const currentPlayerId = await getCurrentPlayerId(roomCode);

  if (!currentPlayerId) {
    return { error: "You are not in this game" };
  }

  // Get room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("code", roomCode)
    .single();

  if (!room) {
    return { error: "Room not found" };
  }

  // Get game state
  const { data: game } = await supabase
    .from("games")
    .select("phase, turn_player_id, last_result")
    .eq("room_id", room.id)
    .single();

  if (!game) {
    return { error: "Game not found" };
  }

  if (game.phase !== "revealing") {
    return { error: "Cannot continue right now" };
  }

  // Only turn player can continue
  const isTurnPlayer = currentPlayerId === game.turn_player_id;
  const lastResult = game.last_result as LastResult | null;

  if (!isTurnPlayer) {
    return { error: "Only the current player can continue" };
  }

  // Get all players in order
  const { data: players } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  if (!players || players.length === 0) {
    return { error: "No players found" };
  }

  // Determine next turn player
  let nextTurnPlayerId = game.turn_player_id;
  
  if (lastResult?.isCorrect) {
    // Correct answer: same player picks again
    nextTurnPlayerId = game.turn_player_id;
  } else {
    // Wrong answer: rotate to next player
    const currentIndex = players.findIndex((p) => p.id === game.turn_player_id);
    const nextIndex = (currentIndex + 1) % players.length;
    nextTurnPlayerId = players[nextIndex].id;
  }

  // Update game to selecting phase
  const { error: updateError } = await supabase
    .from("games")
    .update({
      phase: "selecting",
      selected_clue_id: null,
      turn_player_id: nextTurnPlayerId,
    })
    .eq("room_id", room.id);

  if (updateError) {
    return { error: "Failed to continue game" };
  }

  return { error: null };
}

/**
 * Skip the current clue (no one answered correctly)
 * Only the turn player can skip
 */
export async function skipClue(
  roomCode: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const currentPlayerId = await getCurrentPlayerId(roomCode);

  if (!currentPlayerId) {
    return { error: "You are not in this game" };
  }

  // Get room
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("code", roomCode)
    .single();

  if (!room) {
    return { error: "Room not found" };
  }

  // Get game state
  const { data: game } = await supabase
    .from("games")
    .select("phase, selected_clue_id, revealed_ids, turn_player_id, board_json")
    .eq("room_id", room.id)
    .single();

  if (!game) {
    return { error: "Game not found" };
  }

  if (game.phase !== "answering") {
    return { error: "Cannot skip right now" };
  }

  // Only turn player can skip
  if (currentPlayerId !== game.turn_player_id) {
    return { error: "Only the current player can skip" };
  }

  if (!game.selected_clue_id) {
    return { error: "No clue selected" };
  }

  // Add to revealed without scoring
  const revealedIds = [...((game.revealed_ids as string[]) ?? []), game.selected_clue_id];

  // Check if game is finished
  const board = game.board_json as {
    categories: Array<{ clues: Array<{ id: string }> }>;
  };
  const totalClues = board.categories.reduce(
    (sum, cat) => sum + cat.clues.length,
    0
  );
  const isFinished = revealedIds.length >= totalClues;

  // Create skip result
  const lastResult: LastResult = {
    clueId: game.selected_clue_id,
    playerId: currentPlayerId,
    playerName: "No one",
    isCorrect: false,
    pointsDelta: 0,
    answer: "(skipped)",
  };

  // Update game state
  const { error: updateError } = await supabase
    .from("games")
    .update({
      phase: isFinished ? "finished" : "revealing",
      revealed_ids: revealedIds,
      last_result: lastResult,
    })
    .eq("room_id", room.id);

  if (updateError) {
    return { error: "Failed to skip clue" };
  }

  // If game is finished, also update room status
  if (isFinished) {
    await supabase
      .from("rooms")
      .update({ status: "finished" })
      .eq("id", room.id);
  }

  return { error: null };
}

/**
 * Clean up a finished game - deletes room, players, and game data
 */
export async function cleanupFinishedGame(
  roomCode: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  // Get room
  const { data: room } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", roomCode)
    .single();

  if (!room) {
    // Room already deleted, that's fine
    return { error: null };
  }

  // Only clean up finished games
  if (room.status !== "finished") {
    return { error: "Game is not finished" };
  }

  // Delete room - this cascades to players and games
  const { error: deleteError } = await supabase
    .from("rooms")
    .delete()
    .eq("id", room.id);

  if (deleteError) {
    return { error: "Failed to clean up game data" };
  }

  return { error: null };
}

/**
 * Get the full game state for a room
 */
export async function getGameState(
  roomCode: string
): Promise<{ game: GameState | null; error: string | null }> {
  const supabase = await createClient();

  // Get room
  const { data: room } = await supabase
    .from("rooms")
    .select("id")
    .eq("code", roomCode)
    .single();

  if (!room) {
    return { game: null, error: "Room not found" };
  }

  // Get game
  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("room_id", room.id)
    .single();

  if (!game) {
    return { game: null, error: "Game not found" };
  }

  return {
    game: {
      roomId: game.room_id,
      boardJson: game.board_json,
      phase: game.phase as GamePhase,
      turnPlayerId: game.turn_player_id,
      revealedIds: (game.revealed_ids as string[]) ?? [],
      selectedClueId: game.selected_clue_id,
      lastResult: game.last_result as LastResult | null,
    },
    error: null,
  };
}
