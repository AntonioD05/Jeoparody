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

  // If the host is leaving, delete the room (cascade will delete all players)
  if (room.host_id === playerId) {
    await supabase.from("rooms").delete().eq("id", room.id);
  } else {
    // Non-host leaving: just delete that player
    await supabase.from("players").delete().eq("id", playerId);
  }

  // Clear the player cookie
  cookieStore.delete(`player_${roomCode}`);

  return NextResponse.json({ success: true });
}
