"use server";

import { createClient } from "../../utils/supabase/server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
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
  const cookieStore = await cookies();
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

    // Store player ID in cookie for this room
    cookieStore.set(`player_${code}`, hostId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    // Successfully created room and host
    redirect(`/room/${code}`);
  }

  throw new Error("Failed to generate unique room code after multiple attempts");
}

export async function joinRoom(
  _prevState: { error: string | null },
  formData: FormData
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const playerName = (formData.get("playerName") as string)?.trim();
  const roomCode = (formData.get("roomCode") as string)?.trim().toUpperCase();

  if (!playerName) {
    return { error: "Name is required" };
  }

  if (!roomCode) {
    return { error: "Room code is required" };
  }

  // Look up the room by code
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, status")
    .eq("code", roomCode)
    .single();

  if (roomError || !room) {
    return { error: "Room not found. Please check the code and try again." };
  }

  if (room.status === "finished") {
    return { error: "This game has already ended." };
  }

  // Check if player name is already taken in this room
  const { data: existingPlayer } = await supabase
    .from("players")
    .select("id")
    .eq("room_id", room.id)
    .eq("name", playerName)
    .single();

  if (existingPlayer) {
    return { error: "A player with this name is already in the room." };
  }

  // Insert the new player
  const playerId = randomUUID();
  const { error: playerError } = await supabase.from("players").insert({
    id: playerId,
    room_id: room.id,
    name: playerName,
    score: 0,
  });

  if (playerError) {
    return { error: `Failed to join room: ${playerError.message}` };
  }

  // Store player ID in cookie for this room
  cookieStore.set(`player_${roomCode}`, playerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
  });

  redirect(`/room/${roomCode}`);
}

export async function leaveRoom(roomCode: string) {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const playerId = cookieStore.get(`player_${roomCode}`)?.value;

  if (!playerId) {
    // No player cookie, just redirect
    redirect("/");
  }

  // Get the room first
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("code", roomCode)
    .single();

  if (!room) {
    // Room doesn't exist, clear cookie and redirect
    cookieStore.delete(`player_${roomCode}`);
    redirect("/");
  }

  // If the host is leaving, delete the room (cascade will delete all players)
  if (room.host_id === playerId) {
    await supabase.from("rooms").delete().eq("id", room.id);
  } else {
    // Non-host leaving: just delete that player
    await supabase.from("players").delete().eq("id", playerId);
  }

  // Clear the player cookie
  cookieStore.delete(`player_${roomCode}`);

  redirect("/");
}
