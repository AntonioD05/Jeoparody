import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const roomCode = request.nextUrl.searchParams.get("roomCode");

  if (!roomCode) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const playerId = cookieStore.get(`player_${roomCode}`)?.value;

  if (!playerId) {
    return NextResponse.json({ error: "No player found" }, { status: 404 });
  }

  return NextResponse.json({ playerId });
}
