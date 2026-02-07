"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import HostControls from "../../../components/HostControls";
import PlayerList from "../../../components/PlayerList";
import StatusBadge from "../../../components/StatusBadge";
import { createClient } from "../../../utils/supabase/client";
import { leaveRoom } from "../../actions/rooms";
import type { Player } from "../../../types/game";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RoomPageProps {
  params: Promise<{
    code: string;
  }>;
}

export default function RoomPage({ params }: RoomPageProps) {
  const router = useRouter();
  const { code } = use(params);
  const [copied, setCopied] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const hasUploadedPdf = false;

  // Handle page unload - attempt to leave room
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery on page close
      navigator.sendBeacon(
        "/api/leave-room",
        JSON.stringify({ roomCode: code })
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [code]);

  // Fetch room and players on mount
  useEffect(() => {
    const supabase = createClient();

    async function fetchRoomAndPlayers() {
      // Get room by code
      const { data: room } = await supabase
        .from("rooms")
        .select("id, host_id")
        .eq("code", code)
        .single();

      if (!room) return;

      setRoomId(room.id);
      setHostId(room.host_id);

      // Fetch players for this room
      const { data: playersData } = await supabase
        .from("players")
        .select("id, name, score")
        .eq("room_id", room.id)
        .order("joined_at", { ascending: true });

      if (playersData) {
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

    fetchRoomAndPlayers();
  }, [code]);

  // Subscribe to realtime player changes
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`room-${roomId}-players`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Refetch all players on any change
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

  // Presence tracking - detect when users close their browser/tab
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();
    let currentPlayerId: string | null = null;

    async function setupPresence() {
      // Get current player ID
      const res = await fetch(`/api/current-player?roomCode=${code}`);
      if (!res.ok) return;

      const { playerId } = await res.json();
      currentPlayerId = playerId;

      // Create presence channel
      const channel = supabase.channel(`room-${roomId}-presence`, {
        config: { presence: { key: playerId } },
      });

      channel
        .on("presence", { event: "leave" }, async ({ leftPresences }) => {
          // When someone leaves, remove them from the database
          for (const presence of leftPresences) {
            const leftPlayerId = presence.player_id;
            if (!leftPlayerId) continue;

            // Delete the player
            await supabase.from("players").delete().eq("id", leftPlayerId);

            // Check if room is now empty
            const { count } = await supabase
              .from("players")
              .select("*", { count: "exact", head: true })
              .eq("room_id", roomId);

            if (count === 0) {
              // Delete the room if no players left
              await supabase.from("rooms").delete().eq("id", roomId);
            }
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && currentPlayerId) {
            // Track this player's presence
            await channel.track({ player_id: currentPlayerId });
          }
        });

      presenceChannelRef.current = channel;
    }

    setupPresence();

    return () => {
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
    };
  }, [roomId, code]);

  // Subscribe to room deletion - redirect to home if room is deleted
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`room-${roomId}-deletion`)
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          // Room was deleted, redirect to home
          router.push("/");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, router]);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const temp = document.createElement("textarea");
        temp.value = code;
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
                Room {code}
              </h1>
              <StatusBadge label="Lobby" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-slate-700 bg-slate-950/60 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-amber-300 hover:text-amber-200"
            >
              {copied ? "Copied!" : "Copy Room Code"}
            </button>
            <form action={() => leaveRoom(code)}>
              <button
                type="submit"
                className="rounded-full border border-slate-700 bg-slate-950/60 px-5 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:border-rose-400 hover:text-rose-200"
              >
                Leave Room
              </button>
            </form>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <PlayerList players={players} />
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
