"use server";

import { createClient } from "../../utils/supabase/server";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Excluding confusing chars like 0, O, I, 1
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createRoom(formData: FormData) {
  const supabase = await createClient();
  const hostName = (formData.get("hostName") as string)?.trim() || "Host";

  // Try generating a unique code (retry if collision)
  let code: string;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts) {
    code = generateRoomCode();
    const roomId = randomUUID();
    const hostId = randomUUID();

    // Insert room first with the host_id
    const { error: roomError } = await supabase.from("rooms").insert({
      id: roomId,
      code,
      status: "lobby",
      host_id: hostId,
    });

    if (roomError) {
      // If unique constraint violation on code, retry with new code
      if (roomError.code === "23505") {
        attempts++;
        continue;
      }
      throw new Error(`Failed to create room: ${roomError.message}`);
    }

    // Insert the host player
    const { error: playerError } = await supabase.from("players").insert({
      id: hostId,
      room_id: roomId,
      name: hostName,
      score: 0,
    });

    if (playerError) {
      // Cleanup the room if player creation fails
      await supabase.from("rooms").delete().eq("id", roomId);
      throw new Error(`Failed to create host player: ${playerError.message}`);
    }

    // Successfully created room and host
    redirect(`/room/${code}`);
  }

  throw new Error("Failed to generate unique room code after multiple attempts");
}

export async function joinRoom(formData: FormData) {
  const supabase = await createClient();
  const playerName = (formData.get("playerName") as string)?.trim();
  const roomCode = (formData.get("roomCode") as string)?.trim().toUpperCase();

  if (!playerName) {
    throw new Error("Name is required");
  }

  if (!roomCode) {
    throw new Error("Room code is required");
  }

  // Look up the room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", roomCode)
    .single();

  if (roomError || !room) {
    throw new Error("Room not found. Please check the code and try again.");
  }

  if (room.status === "finished") {
    throw new Error("This game has already ended.");
  }

  // Check if player name is already taken in this room
  const { data: existingPlayer } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room.id)
    .eq("name", playerName)
    .single();

  if (existingPlayer) {
    throw new Error("A player with this name is already in the room.");
  }

  // Insert the new player
  const { error: playerError } = await supabase.from("players").insert({
    id: randomUUID(),
    room_id: room.id,
    name: playerName,
    score: 0,
  });

  if (playerError) {
    throw new Error(`Failed to join room: ${playerError.message}`);
  }

  redirect(`/room/${roomCode}`);
}
