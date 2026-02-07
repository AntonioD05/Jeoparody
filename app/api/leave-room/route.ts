import { createClient } from "../../../utils/supabase/server";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { roomCode } = await request.json();

  if (!roomCode) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 });
  }

  const supabase = await createClient();
  const cookieStore = await cookies();

  const playerId = cookieStore.get(`player_${roomCode}`)?.value;

  if (!playerId) {
    return NextResponse.json({ error: "No player found" }, { status: 404 });
  }

  // Get the room first
  const { data: room } = await supabase
    .from("rooms")
    .select("id, host_id")
    .eq("code", roomCode)
    .single();

  if (!room) {
    cookieStore.delete(`player_${roomCode}`);
    return NextResponse.json({ success: true });
  }

  // Delete the player
  await supabase.from("players").delete().eq("id", playerId);

  // Check if any players remain in the room
  const { count } = await supabase
    .from("players")
    .select("*", { count: "exact", head: true })
    .eq("room_id", room.id);

  // If no players remain, delete the room
  if (count === 0) {
    await supabase.from("rooms").delete().eq("id", room.id);
  } else if (room.host_id === playerId) {
    // If the host left but players remain, assign a new host
    const { data: newHost } = await supabase
      .from("players")
      .select("id")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true })
      .limit(1)
      .single();

    if (newHost) {
      await supabase
        .from("rooms")
        .update({ host_id: newHost.id })
        .eq("id", room.id);
    }
  }

  // Clear the player cookie
  cookieStore.delete(`player_${roomCode}`);

  return NextResponse.json({ success: true });
}
