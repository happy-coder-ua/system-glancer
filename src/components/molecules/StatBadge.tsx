import type { ReactElement } from 'react';

interface StatBadgeProps {
  label: string;
  value: string;
}

export function StatBadge({ label, value }: StatBadgeProps): ReactElement {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  );
}
