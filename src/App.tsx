import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { CpuPanel } from '@/components/organisms/CpuPanel';
import { MemoryPanel } from '@/components/organisms/MemoryPanel';
import { ResourceTablePanel } from '@/components/organisms/ResourceTablePanel';
import { SystemOverview } from '@/components/organisms/SystemOverview';
import type { SystemSnapshot } from '@/types/system';

const REFRESH_INTERVAL_KEY = 'refresh_interval_ms';
const DEFAULT_REFRESH_INTERVAL = 2000;

export function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    window.electronAPI.storeGet(REFRESH_INTERVAL_KEY)
      .then((value) => {
        if (!mounted) {
          return;
        }

        if (typeof value === 'number' && value >= 1000 && value <= 10000) {
          setRefreshInterval(value);
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadSnapshot = async (): Promise<void> => {
      try {
        const nextSnapshot = await window.electronAPI.getSystemSnapshot();
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setError('Failed to read system metrics');
        }
      }
    };

    void loadSnapshot();
    const timer = window.setInterval(() => {
      void loadSnapshot();
    }, refreshInterval);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [refreshInterval]);

  const onRefreshIntervalChange = async (value: number): Promise<void> => {
    setRefreshInterval(value);
    await window.electronAPI.storeSet(REFRESH_INTERVAL_KEY, value);
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_24%),linear-gradient(180deg,_#07100e,_#030807_48%,_#020505)] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[28px] border border-emerald-500/15 bg-slate-950/70 px-6 py-5 shadow-[0_24px_90px_rgba(0,0,0,0.35)] backdrop-blur-sm lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.38em] text-emerald-300">Ubuntu Glancer</div>
            <h1 className="mt-2 font-mono text-3xl font-semibold text-slate-50">System Monitor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Glances-inspired desktop dashboard for Ubuntu with CPU, memory, load, disks, network, process, and sensor visibility.</p>
          </div>
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <label htmlFor="refreshInterval" className="text-xs uppercase tracking-[0.24em] text-slate-500">Refresh</label>
            <select
              id="refreshInterval"
              className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100 outline-none"
              value={refreshInterval}
              onChange={(event) => {
                void onRefreshIntervalChange(Number(event.target.value));
              }}
            >
              <option value={1000}>1s</option>
              <option value={2000}>2s</option>
              <option value={5000}>5s</option>
              <option value={10000}>10s</option>
            </select>
          </div>
        </header>

        {error ? <div className="mb-4 rounded-2xl border border-rose-500/30 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{error}</div> : null}

        {snapshot ? (
          <div className="space-y-4 pb-8">
            <SystemOverview snapshot={snapshot} />
            <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
              <CpuPanel snapshot={snapshot} />
              <MemoryPanel snapshot={snapshot} />
            </div>
            <ResourceTablePanel
              disks={snapshot.disks}
              networks={snapshot.networks}
              processes={snapshot.processes}
              sensors={snapshot.sensors}
            />
          </div>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-[28px] border border-slate-800 bg-slate-950/60 text-sm uppercase tracking-[0.24em] text-slate-500">
            Collecting metrics...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
