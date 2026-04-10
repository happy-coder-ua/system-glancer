import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { StatBadge } from '@/components/molecules/StatBadge';
import { formatBytes, formatPercent } from '@/services/format';
import type { SystemSnapshot } from '@/types/system';

interface MemoryPanelProps {
  snapshot: SystemSnapshot;
}

export function MemoryPanel({ snapshot }: MemoryPanelProps): ReactElement {
  const memoryUsage = snapshot.memory.total > 0 ? snapshot.memory.used / snapshot.memory.total : 0;
  const swapUsage = snapshot.memory.swapTotal > 0 ? snapshot.memory.swapUsed / snapshot.memory.swapTotal : 0;

  return (
    <Panel title="Memory" subtitle="RAM and swap pressure">
      <div className="mb-4 grid gap-3 md:grid-cols-4">
        <StatBadge label="RAM used" value={formatBytes(snapshot.memory.used)} />
        <StatBadge label="RAM total" value={formatBytes(snapshot.memory.total)} />
        <StatBadge label="Swap used" value={formatBytes(snapshot.memory.swapUsed)} />
        <StatBadge label="Swap total" value={formatBytes(snapshot.memory.swapTotal)} />
      </div>
      <div className="grid gap-4">
        <ProgressBar label={`Memory ${formatPercent(memoryUsage)}`} value={memoryUsage} tone="blue" />
        <ProgressBar label={`Swap ${formatPercent(swapUsage)}`} value={swapUsage} tone="amber" />
      </div>
    </Panel>
  );
}
