import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { formatLoad, formatPercent } from '@/services/format';

interface HistorySeries {
  label: string;
  values: number[];
  strokeClassName: string;
  formatter?: (value: number) => string;
}

interface HistoryPanelProps {
  cpuHistory: number[];
  memoryHistory: number[];
  loadHistory: number[];
}

function Sparkline({ values, strokeClassName }: { values: number[]; strokeClassName: string }): ReactElement {
  const graphWidth = 100;
  const graphHeight = 48;
  const safeValues = values.length > 0 ? values : [0];
  const maxValue = Math.max(...safeValues, 0.01);
  const points = safeValues.map((value, index) => {
    const x = safeValues.length === 1 ? 0 : (index / (safeValues.length - 1)) * graphWidth;
    const y = graphHeight - (value / maxValue) * graphHeight;
    return `${x},${Number.isFinite(y) ? y : graphHeight}`;
  });

  return (
    <svg viewBox={`0 0 ${graphWidth} ${graphHeight}`} className="h-14 w-full overflow-visible">
      <polyline
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
        className={strokeClassName}
      />
    </svg>
  );
}

export function HistoryPanel({ cpuHistory, memoryHistory, loadHistory }: HistoryPanelProps): ReactElement {
  const series: HistorySeries[] = [
    {
      label: 'CPU history',
      values: cpuHistory,
      strokeClassName: 'stroke-[var(--gl-cpu)]',
      formatter: formatPercent,
    },
    {
      label: 'Memory history',
      values: memoryHistory,
      strokeClassName: 'stroke-[var(--gl-memory)]',
      formatter: formatPercent,
    },
    {
      label: 'Load 1m history',
      values: loadHistory,
      strokeClassName: 'stroke-[var(--gl-warning)]',
      formatter: formatLoad,
    },
  ];

  return (
    <Panel title="History" subtitle="Recent rolling metrics">
      <div className="grid gap-4 lg:grid-cols-3">
        {series.map((item) => {
          const lastValue = item.values[item.values.length - 1] ?? 0;
          return (
            <div key={item.label} className="rounded-[12px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel-soft)] px-4 py-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--gl-text-dim)]">{item.label}</div>
                <div className="text-sm font-semibold text-[var(--gl-text)]">{item.formatter ? item.formatter(lastValue) : lastValue}</div>
              </div>
              <Sparkline values={item.values} strokeClassName={item.strokeClassName} />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
