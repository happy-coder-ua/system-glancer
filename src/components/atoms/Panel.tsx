import type { ReactElement, ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, children }: PanelProps): ReactElement {
  return (
    <section className="rounded-[24px] border border-emerald-500/15 bg-slate-950/70 p-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-sm">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-slate-400">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
