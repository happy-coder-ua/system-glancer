import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { CpuPanel } from '@/components/organisms/CpuPanel';
import { HistoryPanel } from '@/components/organisms/HistoryPanel';
import { MemoryPanel } from '@/components/organisms/MemoryPanel';
import { ProcessesPanel } from '@/components/organisms/ProcessesPanel';
import { ResourceTablePanel } from '@/components/organisms/ResourceTablePanel';
import { SensorsPanel } from '@/components/organisms/SensorsPanel';
import { SystemOverview } from '@/components/organisms/SystemOverview';
import type { SystemSnapshot } from '@/types/system';

const REFRESH_INTERVAL_KEY = 'refresh_interval_ms';
const DEFAULT_REFRESH_INTERVAL = 2000;
const MAX_HISTORY_POINTS = 40;

interface HistoryState {
  cpu: number[];
  memory: number[];
  load: number[];
}

function appendHistoryValue(values: number[], nextValue: number): number[] {
  return [...values, nextValue].slice(-MAX_HISTORY_POINTS);
}

export function App(): ReactElement {
  const [snapshot, setSnapshot] = useState<SystemSnapshot | null>(null);
  const [refreshInterval, setRefreshInterval] = useState(DEFAULT_REFRESH_INTERVAL);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [killingPid, setKillingPid] = useState<number | null>(null);
  const [history, setHistory] = useState<HistoryState>({ cpu: [], memory: [], load: [] });

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
    let timerId: number | null = null;

    const loadSnapshot = async (): Promise<void> => {
      const startedAt = performance.now();
      try {
        const nextSnapshot = await window.electronAPI.getSystemSnapshot();
        if (!cancelled) {
          setSnapshot(nextSnapshot);
          setError(null);
          setHistory((current) => ({
            cpu: appendHistoryValue(current.cpu, nextSnapshot.cpu.overall),
            memory: appendHistoryValue(
              current.memory,
              nextSnapshot.memory.total > 0 ? nextSnapshot.memory.used / nextSnapshot.memory.total : 0,
            ),
            load: appendHistoryValue(current.load, nextSnapshot.load.one),
          }));
        }
      } catch {
        if (!cancelled) {
          setError('Failed to read system metrics');
        }
      } finally {
        if (!cancelled) {
          const elapsed = performance.now() - startedAt;
          const nextDelay = Math.max(0, refreshInterval - elapsed);
          timerId = window.setTimeout(() => {
            void loadSnapshot();
          }, nextDelay);
        }
      }
    };

    void loadSnapshot();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [refreshInterval]);

  const onRefreshIntervalChange = async (value: number): Promise<void> => {
    setRefreshInterval(value);
    await window.electronAPI.storeSet(REFRESH_INTERVAL_KEY, value);
  };

  const onKillProcess = async (pid: number): Promise<void> => {
    setKillingPid(pid);
    try {
      const result = await window.electronAPI.killProcess(pid);
      if (result.ok) {
        setStatusMessage(`PID ${pid} terminated`);
      } else {
        setStatusMessage(result.error ?? `Failed to terminate PID ${pid}`);
      }
    } catch {
      setStatusMessage(`Failed to terminate PID ${pid}`);
    } finally {
      setKillingPid(null);
      window.setTimeout(() => {
        setStatusMessage(null);
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#3b4347_0%,_#343b3f_18%,_#32393c_100%)] text-[var(--gl-text)]">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-5 py-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 rounded-[14px] border border-[var(--gl-border)] bg-[var(--gl-bg-elevated)] px-6 py-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.38em] text-[var(--gl-accent-soft)]">System Glancer</div>
            <h1 className="mt-2 font-mono text-3xl font-semibold text-[var(--gl-text)]">System Monitor</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--gl-text-muted)]">Glances-inspired desktop dashboard for Ubuntu with CPU, memory, load, disks, network, process, and sensor visibility.</p>
            {snapshot ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--gl-text-dim)]">
                <span>Uptime {snapshot.load.uptime}</span>
                <span>Load {snapshot.load.one.toFixed(2)} / {snapshot.load.five.toFixed(2)} / {snapshot.load.fifteen.toFixed(2)}</span>
              </div>
            ) : null}
          </div>
          <div className="flex items-center gap-3 self-start lg:self-auto">
            <label htmlFor="refreshInterval" className="text-xs uppercase tracking-[0.24em] text-[var(--gl-text-dim)]">Refresh</label>
            <select
              id="refreshInterval"
              className="rounded-2xl border border-[var(--gl-border)] bg-[var(--gl-panel)] px-4 py-2 text-sm text-[var(--gl-text)] outline-none"
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

        {error ? <div className="mb-4 rounded-[12px] border border-[var(--gl-danger)]/35 bg-[color:rgba(248,113,113,0.08)] px-4 py-3 text-sm text-[var(--gl-danger)]">{error}</div> : null}
        {statusMessage ? <div className="mb-4 rounded-[12px] border border-[var(--gl-memory)]/35 bg-[color:rgba(59,130,246,0.08)] px-4 py-3 text-sm text-[var(--gl-text)]">{statusMessage}</div> : null}

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
            />
            <div className="grid gap-4 xl:grid-cols-2">
              <HistoryPanel
                cpuHistory={history.cpu}
                memoryHistory={history.memory}
                loadHistory={history.load}
              />
              <SensorsPanel
                sensors={snapshot.sensors}
              />
            </div>
            <ProcessesPanel
              processes={snapshot.processes}
              killingPid={killingPid}
              onKillProcess={(pid) => {
                void onKillProcess(pid);
              }}
            />
          </div>
        ) : (
          <div className="flex min-h-[320px] items-center justify-center rounded-[14px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel)] text-sm uppercase tracking-[0.24em] text-[var(--gl-text-dim)]">
            Collecting metrics...
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
