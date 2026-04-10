import type { ReactElement } from 'react';

interface StatBadgeProps {
  label: string;
  value: string;
}

export function StatBadge({ label, value }: StatBadgeProps): ReactElement {
  return (
    <div className="rounded-[12px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel-soft)] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--gl-text-dim)]">{label}</div>
      <div className="mt-2 text-lg font-semibold text-[var(--gl-text)]">{value}</div>
    </div>
  );
}
