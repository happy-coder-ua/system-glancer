import type { ReactElement } from 'react';

interface ProgressBarProps {
  label: string;
  value: number;
  tone?: 'green' | 'blue' | 'amber' | 'red';
}

const toneClassMap: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  green: 'bg-emerald-400',
  blue: 'bg-cyan-400',
  amber: 'bg-amber-400',
  red: 'bg-rose-400',
};

export function ProgressBar({ label, value, tone = 'green' }: ProgressBarProps): ReactElement {
  const width = `${Math.max(0, Math.min(100, Math.round(value * 100)))}%`;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.24em] text-slate-400">
        <span>{label}</span>
        <span>{Math.round(value * 100)}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-800/80">
        <div className={`h-full rounded-full ${toneClassMap[tone]}`} style={{ width }} />
      </div>
    </div>
  );
}
