"use client";

type StatusBadgeProps = {
  label: string;
};

export default function StatusBadge({ label }: StatusBadgeProps) {
  return (
    <span className="inline-flex items-center rounded-full border border-slate-700/70 bg-slate-900/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200">
      {label}
    </span>
  );
}
