import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { formatBytes, formatPercent } from '@/services/format';
import type { DiskSnapshot, NetworkSnapshot, ProcessSnapshot, SensorSnapshot } from '@/types/system';

interface ResourceTablePanelProps {
  disks: DiskSnapshot[];
  networks: NetworkSnapshot[];
  processes: ProcessSnapshot[];
  sensors: SensorSnapshot[];
}

export function ResourceTablePanel({ disks, networks, processes, sensors }: ResourceTablePanelProps): ReactElement {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Disks" subtitle="Mounted filesystem usage">
        <div className="space-y-3">
          {disks.map((disk) => (
            <div key={disk.mount} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <div>
                <div className="text-sm font-semibold text-slate-100">{disk.mount}</div>
                <div className="text-xs text-slate-400">{formatBytes(disk.used)} / {formatBytes(disk.total)}</div>
              </div>
              <div className="text-sm font-semibold text-emerald-300">{formatPercent(disk.usage)}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Network" subtitle="Detected interfaces">
        <div className="space-y-3">
          {networks.map((network) => (
            <div key={`${network.name}-${network.address}`} className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-100">{network.name}</span>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{network.family}</span>
              </div>
              <div className="mt-1 text-sm text-slate-400">{network.address}</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Processes" subtitle="Top CPU consumers">
        <div className="overflow-hidden rounded-2xl border border-slate-800">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900/90 text-[11px] uppercase tracking-[0.2em] text-slate-500">
              <tr>
                <th className="px-4 py-3">PID</th>
                <th className="px-4 py-3">Command</th>
                <th className="px-4 py-3">CPU</th>
                <th className="px-4 py-3">MEM</th>
              </tr>
            </thead>
            <tbody>
              {processes.map((process) => (
                <tr key={process.pid} className="border-t border-slate-800 bg-slate-950/40">
                  <td className="px-4 py-3">{process.pid}</td>
                  <td className="px-4 py-3 font-medium text-slate-100">{process.command}</td>
                  <td className="px-4 py-3">{process.cpu.toFixed(1)}%</td>
                  <td className="px-4 py-3">{process.memory.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Sensors" subtitle="Temperature readings">
        <div className="space-y-3">
          {sensors.length > 0 ? sensors.map((sensor) => (
            <div key={`${sensor.name}-${sensor.value}`} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
              <span className="text-sm text-slate-300">{sensor.name}</span>
              <span className="text-sm font-semibold text-amber-300">{sensor.value}</span>
            </div>
          )) : <div className="rounded-2xl border border-dashed border-slate-800 px-4 py-6 text-sm text-slate-500">No sensor data found. Install lm-sensors to enable temperature readings.</div>}
        </div>
      </Panel>
    </div>
  );
}
