import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { formatBytes, formatPercent, formatRatePerSecond } from '@/services/format';
import type { DiskSnapshot, NetworkSnapshot } from '@/types/system';

interface ResourceTablePanelProps {
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
}
export function ResourceTablePanel({ disks, networks }: ResourceTablePanelProps): ReactElement {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Disks" subtitle="Mounted filesystem usage">
        <div className="space-y-3">
          {disks.map((disk) => (
            <div key={`${disk.device}-${disk.mount}`} className="flex items-center justify-between rounded-[12px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel-soft)] px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-[var(--gl-text)]">{disk.deviceLabel}</div>
                {disk.deviceDetails ? <div className="text-xs text-[var(--gl-text-dim)]">{disk.deviceDetails}</div> : null}
                <div className="text-xs text-[var(--gl-text-dim)]">{disk.mount}</div>
                <div className="text-xs text-[var(--gl-text-muted)]">{formatBytes(disk.used)} / {formatBytes(disk.total)}</div>
              </div>
              <div className="text-sm font-semibold text-[var(--gl-accent)]">{formatPercent(disk.usage)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Network" subtitle="Detected interfaces">
        <div className="space-y-3">
          {networks.map((network) => (
            <div key={network.name} className="rounded-[12px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel-soft)] px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[var(--gl-text)]">{network.name}</span>
              </div>
              <div className="mt-1 text-sm text-[var(--gl-text-muted)]">{network.addresses.join(' • ')}</div>
              {network.subnetMasks.length > 0 ? <div className="mt-1 text-xs text-[var(--gl-text-dim)]">Mask {network.subnetMasks.join(' • ')}</div> : null}
              {network.gateways.length > 0 ? <div className="mt-1 text-xs text-[var(--gl-text-dim)]">Gateway {network.gateways.join(' • ')}</div> : null}
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--gl-text-muted)]">
                <div>RX {formatRatePerSecond(network.rxBytesPerSecond)}</div>
                <div>TX {formatRatePerSecond(network.txBytesPerSecond)}</div>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
