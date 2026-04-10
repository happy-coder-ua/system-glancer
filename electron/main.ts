import { app, BrowserWindow, ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { promisify } from 'node:util';
import Store from 'electron-store';

const execFileAsync = promisify(execFile);
const store = new Store();
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

interface CpuTimesSnapshot {
  idle: number;
  total: number;
}

interface DiskSnapshot {
  mount: string;
  used: number;
  total: number;
  usage: number;
}

interface NetworkSnapshot {
  name: string;
  address: string;
  family: string;
  internal: boolean;
  rxBytesPerSecond: number;
  txBytesPerSecond: number;
}

interface ProcessSnapshot {
  pid: number;
  user: string;
  state: string;
  elapsed: string;
  command: string;
  commandLine: string;
  cpu: number;
  memory: number;
}

interface SensorSnapshot {
  name: string;
  value: string;
}

let previousCpuTimes: CpuTimesSnapshot[] | null = null;
let previousNetworkStats: Record<string, { rxBytes: number; txBytes: number }> | null = null;
let previousNetworkTimestamp: number | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'System Glancer',
    backgroundColor: '#08110f',
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

function formatKernel(): string {
  return `${os.type()} ${os.release()}`;
}

function getCpuUsage() {
  const cpus = os.cpus();
  const current = cpus.map((cpu) => {
    const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
    return {
      idle: cpu.times.idle,
      total,
    };
  });

  const perCore = current.map((snapshot, index) => {
    const previous = previousCpuTimes?.[index];
    if (!previous) {
      return {
        label: `CPU ${index + 1}`,
        usage: 0,
      };
    }

    const totalDelta = snapshot.total - previous.total;
    const idleDelta = snapshot.idle - previous.idle;
    const usage = totalDelta > 0 ? Math.max(0, Math.min(1, 1 - idleDelta / totalDelta)) : 0;

    return {
      label: `CPU ${index + 1}`,
      usage,
    };
  });

  previousCpuTimes = current;

  const overall = perCore.length > 0
    ? perCore.reduce((sum, core) => sum + core.usage, 0) / perCore.length
    : 0;

  return {
    model: cpus[0]?.model ?? 'Unknown CPU',
    cores: cpus.length,
    overall,
    perCore,
  };
}

async function getSwapInfo(): Promise<{ total: number; used: number }> {
  try {
    const { stdout } = await execFileAsync('free', ['-b']);
    const line = stdout
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('Swap:'));

    if (!line) {
      return { total: 0, used: 0 };
    }

    const [, total, used] = line.split(/\s+/);
    return {
      total: Number(total) || 0,
      used: Number(used) || 0,
    };
  } catch {
    return { total: 0, used: 0 };
  }
}

async function getDiskInfo(): Promise<DiskSnapshot[]> {
  try {
    const ignoredTypes = new Set([
      'autofs',
      'bpf',
      'configfs',
      'cgroup',
      'cgroup2',
      'debugfs',
      'devpts',
      'devtmpfs',
      'efivarfs',
      'fusectl',
      'hugetlbfs',
      'mqueue',
      'proc',
      'pstore',
      'rpc_pipefs',
      'securityfs',
      'squashfs',
      'sysfs',
      'tmpfs',
      'tracefs',
    ]);

    const { stdout } = await execFileAsync('df', ['-kPT']);
    const seenMounts = new Set<string>();

    return stdout
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/))
      .map((parts) => {
        const filesystem = parts[0] ?? '';
        const type = parts[1] ?? '';
        const total = Number(parts[2]) * 1024;
        const used = Number(parts[3]) * 1024;
        const mount = parts[6] ?? parts[parts.length - 1] ?? '/';

        return {
          filesystem,
          type,
          mount,
          used,
          total,
          usage: total > 0 ? used / total : 0,
        };
      })
      .filter((disk) => !ignoredTypes.has(disk.type))
      .filter((disk) => !disk.mount.startsWith('/snap/'))
      .filter((disk) => !disk.mount.startsWith('/proc/'))
      .filter((disk) => !disk.mount.startsWith('/sys/'))
      .filter((disk) => !disk.mount.startsWith('/dev/'))
      .filter((disk) => disk.total > 0)
      .filter((disk) => {
        if (seenMounts.has(disk.mount)) {
          return false;
        }
        seenMounts.add(disk.mount);
        return true;
      })
      .map(({ mount, used, total, usage }) => ({
        mount,
        used,
        total,
        usage,
      }))
      .sort((left, right) => left.mount.localeCompare(right.mount));
  } catch {
    return [];
  }
}

async function getNetworkInfo(): Promise<NetworkSnapshot[]> {
  const interfaces = os.networkInterfaces();
  const visibleInterfaces = Object.entries(interfaces)
    .flatMap(([name, entries]) => (entries ?? []).map((entry) => ({ name, entry })))
    .filter(({ entry }) => !entry.internal);

  let counters: Record<string, { rxBytes: number; txBytes: number }> = {};
  try {
    const procNetDev = await readFile('/proc/net/dev', 'utf-8');
    counters = procNetDev
      .split('\n')
      .slice(2)
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce<Record<string, { rxBytes: number; txBytes: number }>>((accumulator, line) => {
        const [namePart, metricsPart] = line.split(':');
        if (!namePart || !metricsPart) {
          return accumulator;
        }

        const values = metricsPart.trim().split(/\s+/);
        accumulator[namePart.trim()] = {
          rxBytes: Number(values[0]) || 0,
          txBytes: Number(values[8]) || 0,
        };
        return accumulator;
      }, {});
  } catch {
    counters = {};
  }

  const now = Date.now();
  const elapsedSeconds = previousNetworkTimestamp ? Math.max((now - previousNetworkTimestamp) / 1000, 0.001) : null;

  const snapshots = visibleInterfaces
    .map(({ name, entry }) => ({
      name,
      address: entry.address,
      family: entry.family,
      internal: entry.internal,
      rxBytesPerSecond: elapsedSeconds && previousNetworkStats?.[name]
        ? Math.max(0, (counters[name]?.rxBytes ?? 0) - previousNetworkStats[name].rxBytes) / elapsedSeconds
        : 0,
      txBytesPerSecond: elapsedSeconds && previousNetworkStats?.[name]
        ? Math.max(0, (counters[name]?.txBytes ?? 0) - previousNetworkStats[name].txBytes) / elapsedSeconds
        : 0,
    }));

  previousNetworkStats = counters;
  previousNetworkTimestamp = now;

  return snapshots;
}

async function getProcesses(): Promise<ProcessSnapshot[]> {
  try {
    const { stdout } = await execFileAsync('ps', [
      '-ww',
      '-eo',
      'pid=,user=,state=,etime=,%cpu=,%mem=,comm=,args=',
      '--sort=-%cpu',
      '--no-headers',
    ]);

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\S+)\s+(.+)$/);
        if (!match) {
          return null;
        }

        return {
          pid: Number(match[1]),
          user: match[2],
          state: match[3],
          elapsed: match[4],
          cpu: Number(match[5]),
          memory: Number(match[6]),
          command: match[7],
          commandLine: match[8],
        };
      })
      .filter((process): process is ProcessSnapshot => process !== null);
  } catch {
    return [];
  }
}

async function getSensors(): Promise<SensorSnapshot[]> {
  try {
    const hwmonBase = '/sys/class/hwmon';
    const result: SensorSnapshot[] = [];
    const devices = await readdir(hwmonBase).catch(() => [] as string[]);

    for (const device of devices) {
      const devicePath = path.join(hwmonBase, device);
      const deviceName = await readFile(path.join(devicePath, 'name'), 'utf8').then((s) => s.trim()).catch(() => device);

      const entries = await readdir(devicePath).catch(() => [] as string[]);
      const tempInputs = entries.filter((e) => /^temp\d+_input$/.test(e)).sort();

      for (const input of tempInputs) {
        const index = input.match(/\d+/)?.[0] ?? '';
        const raw = await readFile(path.join(devicePath, input), 'utf8').catch(() => '');
        if (!raw) continue;

        const current = Number(raw.trim()) / 1000;
        if (!Number.isFinite(current)) continue;

        const label = await readFile(path.join(devicePath, `temp${index}_label`), 'utf8').then((s) => s.trim()).catch(() => '');
        const high = await readFile(path.join(devicePath, `temp${index}_max`), 'utf8').then((s) => Number(s.trim()) / 1000).catch(() => null);
        const crit = await readFile(path.join(devicePath, `temp${index}_crit`), 'utf8').then((s) => Number(s.trim()) / 1000).catch(() => null);

        const name = label || `${deviceName} temp${index}`;
        const limits: string[] = [];
        if (high !== null && Number.isFinite(high)) limits.push(`high = +${high.toFixed(1)}°C`);
        if (crit !== null && Number.isFinite(crit)) limits.push(`crit = +${crit.toFixed(1)}°C`);

        const value = `+${current.toFixed(1)}°C` + (limits.length > 0 ? `  (${limits.join(', ')})` : '');
        result.push({ name, value });
      }
    }

    return result.slice(0, 8);
  } catch {
    return [];
  }
}

function formatUptime(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (hours > 0 || days > 0) {
    parts.push(`${hours}h`);
  }
  parts.push(`${minutes}m`);
  return parts.join(' ');
}

async function getSystemSnapshot() {
  const memoryTotal = os.totalmem();
  const memoryFree = os.freemem();
  const swap = await getSwapInfo();
  const [diskUsage, processes, sensors, networks] = await Promise.all([
    getDiskInfo(),
    getProcesses(),
    getSensors(),
    getNetworkInfo(),
  ]);

  return {
    hostname: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`,
    kernel: formatKernel(),
    cpu: getCpuUsage(),
    memory: {
      total: memoryTotal,
      used: memoryTotal - memoryFree,
      free: memoryFree,
      swapTotal: swap.total,
      swapUsed: swap.used,
    },
    load: {
      one: os.loadavg()[0],
      five: os.loadavg()[1],
      fifteen: os.loadavg()[2],
      uptime: formatUptime(os.uptime()),
    },
    disks: diskUsage,
    networks,
    processes,
    sensors,
    timestamp: Date.now(),
  };
}

ipcMain.handle('system:get-snapshot', async () => {
  return getSystemSnapshot();
});

ipcMain.handle('system:kill-process', async (_event, pid: number) => {
  try {
    process.kill(pid, 'SIGTERM');
    return { ok: true };
  } catch (error: unknown) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to terminate process',
    };
  }
});

ipcMain.handle('store-get', (_event, key: string) => {
  return store.get(key) ?? null;
});

ipcMain.handle('store-set', (_event, key: string, value: unknown) => {
  store.set(key, value);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
