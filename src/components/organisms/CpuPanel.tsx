import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { StatBadge } from '@/components/molecules/StatBadge';
import { formatLoad, formatPercent } from '@/services/format';
import type { SystemSnapshot } from '@/types/system';

interface CpuPanelProps {
  snapshot: SystemSnapshot;
}

export function CpuPanel({ snapshot }: CpuPanelProps): ReactElement {
  return (
    <Panel title="CPU" subtitle={snapshot.cpu.model}>
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatBadge label="Overall" value={formatPercent(snapshot.cpu.overall)} />
        <StatBadge label="Cores" value={String(snapshot.cpu.cores)} />
        <StatBadge label="Load 1m" value={formatLoad(snapshot.load.one)} />
        <StatBadge label="Uptime" value={snapshot.load.uptime} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.cpu.perCore.map((core) => (
          <ProgressBar key={core.label} label={core.label} value={core.usage} tone="green" />
        ))}
      </div>
    </Panel>
  );
}
