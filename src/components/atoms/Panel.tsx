import type { ReactElement, ReactNode } from 'react';

interface PanelProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
}

export function Panel({ title, subtitle, children }: PanelProps): ReactElement {
  return (
    <section className="rounded-[14px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel)] p-4">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--gl-accent-soft)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--gl-text-muted)]">{subtitle}</p> : null}
        </div>
      </div>
      {children}
    </section>
  );
}
