import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { StatBadge } from '@/components/molecules/StatBadge';
import type { SystemSnapshot } from '@/types/system';
import { formatTimestamp } from '@/services/format';

interface SystemOverviewProps {
  snapshot: SystemSnapshot;
}

export function SystemOverview({ snapshot }: SystemOverviewProps): ReactElement {
  return (
    <Panel title="System" subtitle="Live Ubuntu host overview">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatBadge label="Host" value={snapshot.hostname} />
        <StatBadge label="Kernel" value={snapshot.kernel} />
        <StatBadge label="Platform" value={snapshot.platform} />
        <StatBadge label="Updated" value={formatTimestamp(snapshot.timestamp)} />
      </div>
    </Panel>
  );
}
