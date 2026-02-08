"use client";

type HostControlsProps = {
  canStart?: boolean;
  onStart: () => void;
  onFileSelect: (file: File | null) => void;
  fileName?: string | null;
  isGenerating?: boolean;
  error?: string | null;
  roomId?: string | null;
  onRoomIdChange?: (value: string) => void;
  progress?: { stage: string; percent: number } | null;
};

export default function HostControls({
  canStart = false,
  onStart,
  onFileSelect,
  fileName,
  isGenerating = false,
  error,
  roomId,
  onRoomIdChange,
  progress,
}: HostControlsProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-white">Host Controls</h2>
      <div className="mt-4 flex flex-col gap-3 text-sm text-slate-200">
        {typeof onRoomIdChange === "function" ? (
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Room ID (UUID)
            <input
              value={roomId ?? ""}
              onChange={(event) => onRoomIdChange(event.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none focus:border-amber-300"
            />
          </label>
        ) : null}
        <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
          PDF File
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) =>
              onFileSelect(event.target.files?.[0] ?? null)
            }
            disabled={isGenerating}
            className="rounded-xl border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-slate-100 disabled:opacity-50"
          />
        </label>
        {fileName && !isGenerating ? (
          <p className="text-xs text-slate-400">Selected: {fileName}</p>
        ) : null}
        
        {/* Progress bar */}
        {isGenerating && progress ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-amber-200">{progress.stage}</span>
              <span className="text-slate-400">{progress.percent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-500 ease-out"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        ) : null}
        
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart || isGenerating}
          className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-amber-50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/40 disabled:text-slate-400"
        >
          {isGenerating ? "Generating..." : "Start Game"}
        </button>
        {error ? (
          <div className="rounded-xl border border-rose-400/40 bg-rose-400/10 p-3 text-xs text-rose-100">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}
