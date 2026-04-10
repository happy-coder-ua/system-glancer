import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import type { ProcessSnapshot } from '@/types/system';

interface ProcessesPanelProps {
  processes: ProcessSnapshot[];
  killingPid: number | null;
  onKillProcess: (pid: number) => void;
}

function formatProcessName(command: string): string {
  const normalized = command.trim();
  const withoutPath = normalized.includes('/') ? normalized.split('/').pop() ?? normalized : normalized;

  return withoutPath
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatProcessState(state: string): string {
  switch (state.toUpperCase()) {
    case 'R':
      return 'Running';
    case 'S':
      return 'Sleeping';
    case 'D':
      return 'Waiting';
    case 'T':
      return 'Stopped';
    case 'Z':
      return 'Zombie';
    case 'I':
      return 'Idle';
    default:
      return state;
  }
}

export function ProcessesPanel({ processes, killingPid, onKillProcess }: ProcessesPanelProps): ReactElement {
  return (
    <Panel title="Processes" subtitle="Top CPU consumers">
      <div className="grid gap-3 xl:grid-cols-2">
        {processes.map((process) => (
          <div key={process.pid} className="rounded-[12px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel-soft)] px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold capitalize text-[var(--gl-text)]">{formatProcessName(process.command)}</div>
                <div className="mt-1 truncate text-xs text-[var(--gl-text-muted)]">{process.commandLine}</div>
              </div>
              <button
                type="button"
                className="rounded-[10px] border border-[var(--gl-danger)]/35 bg-[color:rgba(248,113,113,0.08)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--gl-danger)] disabled:cursor-not-allowed disabled:opacity-60"
                disabled={killingPid === process.pid}
                onClick={() => onKillProcess(process.pid)}
              >
                {killingPid === process.pid ? 'Terminating' : 'Terminate'}
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-[10px] uppercase tracking-[0.16em] text-[var(--gl-text-dim)]">
              <span className="rounded-[999px] border border-[var(--gl-border)] bg-[var(--gl-bg-elevated)] px-2.5 py-1">PID {process.pid}</span>
              <span className="rounded-[999px] border border-[var(--gl-border)] bg-[var(--gl-bg-elevated)] px-2.5 py-1">User {process.user}</span>
              <span className="rounded-[999px] border border-[var(--gl-border)] bg-[var(--gl-bg-elevated)] px-2.5 py-1">{formatProcessState(process.state)}</span>
              <span className="rounded-[999px] border border-[var(--gl-border)] bg-[var(--gl-bg-elevated)] px-2.5 py-1">Up {process.elapsed}</span>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <ProgressBar label="CPU load" value={Math.max(0, Math.min(process.cpu / 100, 1))} tone="green" />
              <ProgressBar label="Memory use" value={Math.max(0, Math.min(process.memory / 100, 1))} tone="blue" />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
