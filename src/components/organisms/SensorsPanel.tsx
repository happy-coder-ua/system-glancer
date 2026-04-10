import type { ReactElement } from 'react';
import { Panel } from '@/components/atoms/Panel';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import type { SensorSnapshot } from '@/types/system';

interface SensorsPanelProps {
  sensors: SensorSnapshot[];
}

interface SensorLimit {
  label: 'low' | 'high' | 'crit';
  value: number;
}

interface ParsedSensorDetails {
  current: number | null;
  limits: SensorLimit[];
}

function isReasonableSensorLimit(limit: SensorLimit): boolean {
  if (limit.label === 'low') {
    return limit.value > -100 && limit.value < 120;
  }

  return limit.value > 0 && limit.value <= 150;
}

function parseTemperatureValue(value: string): number | null {
  const match = value.match(/[-+]?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseSensorDetails(value: string): ParsedSensorDetails {
  const current = parseTemperatureValue(value);
  const limits = Array.from(value.matchAll(/(low|high|crit)\s*=\s*([-+]?\d+(?:\.\d+)?)°C/gi))
    .map((match) => ({
      label: match[1].toLowerCase() as SensorLimit['label'],
      value: Number(match[2]),
    }))
    .filter((limit) => Number.isFinite(limit.value))
    .filter(isReasonableSensorLimit)
    .filter((limit) => !(limit.label === 'low' && limit.value <= -200));

  return { current, limits };
}

function formatTemperature(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}°C`;
}

function formatSensorName(name: string): string {
  const trimmed = name.trim();

  const coreMatch = trimmed.match(/^Core\s+(\d+)$/i);
  if (coreMatch) {
    return `CPU core ${Number(coreMatch[1]) + 1}`;
  }

  const sensorMatch = trimmed.match(/^Sensor\s+(\d+)$/i);
  if (sensorMatch) {
    return `Temperature sensor ${sensorMatch[1]}`;
  }

  const packageMatch = trimmed.match(/^Package\s+id\s+(\d+)$/i);
  if (packageMatch) {
    return `CPU package ${packageMatch[1]}`;
  }

  if (/^Composite$/i.test(trimmed)) {
    return 'Composite sensor';
  }

  if (/^Battery$/i.test(trimmed)) {
    return 'Battery health';
  }

  return trimmed
    .replace(/_/g, ' ')
    .replace(/\bid\b/gi, 'ID')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSensorTone(temperature: number): 'green' | 'blue' | 'amber' | 'red' {
  if (temperature >= 80) {
    return 'red';
  }
  if (temperature >= 65) {
    return 'amber';
  }
  if (temperature >= 45) {
    return 'blue';
  }
  return 'green';
}

export function SensorsPanel({ sensors }: SensorsPanelProps): ReactElement {
  return (
    <Panel title="Sensors" subtitle="Temperature readings">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        {sensors.length > 0 ? sensors.map((sensor) => {
          const details = parseSensorDetails(sensor.value);
          const temperature = details.current;
          const normalizedValue = temperature !== null ? Math.max(0, Math.min(temperature / 100, 1)) : 0;
          const displayName = formatSensorName(sensor.name);

          return (
            <div key={`${sensor.name}-${sensor.value}`} className="rounded-[12px] border border-[var(--gl-border-soft)] bg-[var(--gl-panel-soft)] px-4 py-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <span className="text-sm font-semibold text-[var(--gl-text)]">{displayName}</span>
                  {details.limits.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {details.limits.map((limit) => (
                        <span
                          key={`${sensor.name}-${limit.label}`}
                          className="rounded-[999px] border border-[var(--gl-border)] bg-[var(--gl-bg-elevated)] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-[var(--gl-text-dim)]"
                        >
                          {limit.label} {formatTemperature(limit.value)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <span className="text-base font-semibold text-[var(--gl-warning)]">
                  {temperature !== null ? formatTemperature(temperature) : sensor.value}
                </span>
              </div>
              <ProgressBar
                label="Temperature"
                value={normalizedValue}
                tone={temperature !== null ? getSensorTone(temperature) : 'amber'}
              />
            </div>
          );
        }) : <div className="rounded-[12px] border border-dashed border-[var(--gl-border)] px-4 py-6 text-sm text-[var(--gl-text-dim)]">No sensor data found. If installed as a snap, run: sudo snap connect system-glancer:hardware-observe</div>}
      </div>
    </Panel>
  );
}
