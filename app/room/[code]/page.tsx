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
import type { Board } from "../../../types/board-schema";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [board, setBoard] = useState<Board | null>(null);
  const [manualRoomId, setManualRoomId] = useState("");
  const [hostLeft, setHostLeft] = useState(false);
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);

  // Fetch room and players on mount
  useEffect(() => {
    const supabase = createClient();

    async function fetchRoomAndPlayers() {
      // Get current player ID from cookie
      const playerRes = await fetch(`/api/current-player?roomCode=${code}`);
      if (playerRes.ok) {
        const { playerId } = await playerRes.json();
        setCurrentPlayerId(playerId);
      }

      // Get room by code
      const { data: room } = await supabase
        .from("rooms")
        .select("id, host_id, status")
        .eq("code", code)
        .single();

      if (!room) {
        setRoomNotFound(true);
        setIsLoading(false);
        return;
      }

      setRoomId(room.id);
      setHostId(room.host_id);

      if (room.status === "playing") {
        router.push(`/game/${code}`);
        return;
      }

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

      setIsLoading(false);
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

      // Helper to clean up disconnected players
      const cleanupDisconnectedPlayers = async () => {
        const presenceState = channel.presenceState();
        const presentPlayerIds = new Set<string>();
        
        // Collect all player IDs currently in presence
        for (const presences of Object.values(presenceState)) {
          for (const presence of presences as { player_id: string }[]) {
            if (presence.player_id) {
              presentPlayerIds.add(presence.player_id);
            }
          }
        }

        // Get all players in the room from database
        const { data: dbPlayers } = await supabase
          .from("players")
          .select("id")
          .eq("room_id", roomId);

        if (!dbPlayers) return;

        // Find players in DB but not in presence (disconnected)
        for (const dbPlayer of dbPlayers) {
          if (!presentPlayerIds.has(dbPlayer.id) && dbPlayer.id !== currentPlayerId) {
            // This player is in DB but not tracked in presence - they've disconnected
            
            // Check if they're the host
            const { data: room } = await supabase
              .from("rooms")
              .select("host_id, status")
              .eq("id", roomId)
              .single();

            if (!room) return;

            if (room.host_id === dbPlayer.id) {
              // Host left. If game is playing, keep room alive.
              if (room.status !== "playing") {
                await supabase.from("rooms").delete().eq("id", roomId);
              }
              return;
            } else {
              // Non-host left - delete that player
              await supabase.from("players").delete().eq("id", dbPlayer.id);
            }
          }
        }
      };

      channel
        .on("presence", { event: "sync" }, () => {
          // On every sync, check for disconnected players after a delay
          setTimeout(cleanupDisconnectedPlayers, 5000);
        })
        .on("presence", { event: "leave" }, async ({ leftPresences }) => {
          // When someone leaves, handle cleanup after a delay
          for (const presence of leftPresences) {
            const leftPlayerId = presence.player_id;
            if (!leftPlayerId) continue;

            // Wait before deleting to allow for reconnection
            setTimeout(async () => {
              // Check if player has reconnected
              const presenceState = channel.presenceState();
              const isStillPresent = Object.values(presenceState).some(
                (presences) =>
                  (presences as { player_id: string }[]).some(
                    (p) => p.player_id === leftPlayerId
                  )
              );

              if (isStillPresent) {
                return;
              }

              // Check if the leaving player was the host
              const { data: room } = await supabase
                .from("rooms")
                .select("host_id, status")
                .eq("id", roomId)
                .single();

              if (!room) return;

              if (room.host_id === leftPlayerId) {
                if (room.status !== "playing") {
                  await supabase.from("rooms").delete().eq("id", roomId);
                }
              } else {
                await supabase.from("players").delete().eq("id", leftPlayerId);
              }
            }, 5000);
          }
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && currentPlayerId) {
            // Track this player's presence
            await channel.track({ player_id: currentPlayerId });
          }
        });

      presenceChannelRef.current = channel;

      // Periodic cleanup check every 10 seconds as a fallback
      const cleanupInterval = setInterval(() => {
        cleanupDisconnectedPlayers();
      }, 10000);

      // Store interval for cleanup
      (channel as unknown as { _cleanupInterval: NodeJS.Timeout })._cleanupInterval = cleanupInterval;
    }

    setupPresence();

    return () => {
      if (presenceChannelRef.current) {
        const interval = (presenceChannelRef.current as unknown as { _cleanupInterval?: NodeJS.Timeout })._cleanupInterval;
        if (interval) clearInterval(interval);
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
          // Room was deleted (host left), show message then redirect
          setHostLeft(true);
          setTimeout(() => {
            router.push("/");
          }, 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, router]);

  // Subscribe to room status changes - redirect to game when playing
  useEffect(() => {
    if (!roomId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`room-${roomId}-status`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          const status = (payload.new as { status?: string } | null)?.status;
          if (status === "playing") {
            router.push(`/game/${code}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, router, code]);

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

  useEffect(() => {
    if (!manualRoomId && roomId) {
      setManualRoomId(roomId);
    }
  }, [manualRoomId, roomId]);

  const handleGenerateBoard = async () => {
    if (!selectedFile) {
      setError("Please choose a PDF to upload.");
      return;
    }

    if (!manualRoomId.trim()) {
      setError("Please enter the room UUID.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    setBoard(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const extractResponse = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });

      if (!extractResponse.ok) {
        const extractError = await extractResponse.json();
        throw new Error(extractError?.error || "PDF extraction failed.");
      }

      const extractJson = await extractResponse.json();

      const generateResponse = await fetch("/api/generate-board", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId: manualRoomId.trim(),
          chunks: extractJson.chunks ?? [],
        }),
      });

      if (!generateResponse.ok) {
        const generateError = await generateResponse.json();
        throw new Error(generateError?.error || "Board generation failed.");
      }

      await generateResponse.json();
      router.push(`/game/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-amber-400"></div>
          <p className="mt-4 text-sm text-slate-400">Loading room...</p>
        </div>
      </div>
    );
  }

  if (roomNotFound) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <div className="mx-4 max-w-md text-center">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-rose-500/20">
            <svg
              className="h-10 w-10 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Room Not Found</h1>
          <p className="mt-3 text-slate-400">
            The room code <span className="font-mono text-rose-400">{code}</span> does not exist or has been closed.
          </p>
          <button
            onClick={() => router.push("/")}
            className="mt-8 rounded-full border border-amber-400/50 bg-amber-400/10 px-8 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-amber-200 transition hover:bg-amber-400/20"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 px-6 py-12 text-white">
      {hostLeft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm">
          <div className="mx-4 max-w-md rounded-2xl border border-rose-500/50 bg-slate-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-500/20">
              <svg
                className="h-8 w-8 text-rose-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-white">Host Left the Room</h2>
            <p className="mt-2 text-slate-400">
              The host has left and the room has been closed. You will be redirected to the home page shortly.
            </p>
            <div className="mt-4 text-sm text-slate-500">Redirecting in 3 seconds...</div>
          </div>
        </div>
      )}
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
            {currentPlayerId && hostId && currentPlayerId === hostId ? (
              <HostControls
                canStart={Boolean(selectedFile) && Boolean(manualRoomId.trim())}
                onStart={handleGenerateBoard}
                onFileSelect={setSelectedFile}
                fileName={selectedFile?.name ?? null}
                isGenerating={isGenerating}
                error={error}
                roomId={manualRoomId}
                onRoomIdChange={
                  roomId ? undefined : (value) => setManualRoomId(value)
                }
              />
            ) : (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <h2 className="text-lg font-semibold text-white">Waiting for Host</h2>
                <p className="mt-2 text-sm text-slate-400">
                  The host will upload a PDF and start the game.
                </p>
              </div>
            )}
            {currentPlayerId === hostId ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 p-5 text-sm text-slate-300">
                <p className="font-semibold text-white">Next steps</p>
                <p className="mt-2 text-slate-300">
                  Upload a trivia PDF to generate the board, then start the game
                  when everyone is ready.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
                Waiting for host to upload a PDF and start the game.
              </div>
            )}
          </div>
        </section>
        {board ? (
          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-semibold text-white">Generated Board</h2>
            <div className="mt-4 grid grid-cols-5 gap-3 text-center text-xs font-semibold uppercase tracking-[0.15em] text-slate-200">
              {board.categories.map((category) => (
                <div
                  key={category.title}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-3"
                >
                  {category.title}
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-5 gap-3">
              {board.categories.flatMap((category) =>
                category.clues.map((clue) => (
                  <button
                    key={clue.id}
                    type="button"
                    className="min-h-[72px] rounded-xl border border-amber-400/30 bg-amber-400/10 text-sm font-semibold text-amber-100"
                  >
                    ${clue.value}
                  </button>
                )),
              )}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
