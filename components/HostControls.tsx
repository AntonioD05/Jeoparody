"use client";

type HostControlsProps = {
  canStart?: boolean;
  onUpload: () => void;
  onStart: () => void;
};

export default function HostControls({
  canStart = false,
  onUpload,
  onStart,
}: HostControlsProps) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
      <h2 className="text-lg font-semibold text-white">Host Controls</h2>
      <div className="mt-4 flex flex-col gap-3">
        <button
          type="button"
          onClick={onUpload}
          className="rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3 text-sm font-semibold text-white transition hover:border-amber-300 hover:text-amber-200"
        >
          Upload PDF
        </button>
        <button
          type="button"
          onClick={onStart}
          disabled={!canStart}
          className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:border-amber-300 hover:text-amber-50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-900/40 disabled:text-slate-400"
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
