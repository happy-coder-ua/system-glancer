import { app, BrowserWindow, ipcMain } from 'electron';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
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
}

interface ProcessSnapshot {
  pid: number;
  command: string;
  cpu: number;
  memory: number;
}

interface SensorSnapshot {
  name: string;
  value: string;
}

let previousCpuTimes: CpuTimesSnapshot[] | null = null;

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1180,
    minHeight: 760,
    title: 'Ubuntu Glancer',
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
    const targets = ['/'];
    const homeDirectory = os.homedir();
    if (homeDirectory && homeDirectory !== '/') {
      targets.push(homeDirectory);
    }

    const { stdout } = await execFileAsync('df', ['-kP', ...targets]);
    const seenMounts = new Set<string>();

    return stdout
      .split('\n')
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.split(/\s+/))
      .map((parts) => {
        const total = Number(parts[1]) * 1024;
        const used = Number(parts[2]) * 1024;
        const mount = parts[5] ?? parts[parts.length - 1] ?? '/';

        return {
          mount,
          used,
          total,
          usage: total > 0 ? used / total : 0,
        };
      })
      .filter((disk) => {
        if (seenMounts.has(disk.mount)) {
          return false;
        }
        seenMounts.add(disk.mount);
        return true;
      });
  } catch {
    return [];
  }
}

function getNetworkInfo(): NetworkSnapshot[] {
  const interfaces = os.networkInterfaces();

  return Object.entries(interfaces)
    .flatMap(([name, entries]) => (entries ?? []).map((entry) => ({ name, entry })))
    .filter(({ entry }) => !entry.internal)
    .map(({ name, entry }) => ({
      name,
      address: entry.address,
      family: entry.family,
      internal: entry.internal,
    }));
}

async function getProcesses(): Promise<ProcessSnapshot[]> {
  try {
    const { stdout } = await execFileAsync('ps', ['-eo', 'pid=,comm=,%cpu=,%mem=', '--sort=-%cpu']);

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.+?)\s+([\d.]+)\s+([\d.]+)$/);
        if (!match) {
          return null;
        }

        return {
          pid: Number(match[1]),
          command: match[2],
          cpu: Number(match[3]),
          memory: Number(match[4]),
        };
      })
      .filter((process): process is ProcessSnapshot => process !== null);
  } catch {
    return [];
  }
}

async function getSensors(): Promise<SensorSnapshot[]> {
  try {
    const { stdout } = await execFileAsync('sensors', []);

    return stdout
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.includes('°C'))
      .slice(0, 8)
      .map((line) => {
        const [namePart, valuePart] = line.split(':');
        return {
          name: namePart.trim(),
          value: valuePart?.trim() ?? '',
        };
      });
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
  const [diskUsage, processes, sensors] = await Promise.all([
    getDiskInfo(),
    getProcesses(),
    getSensors(),
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
    networks: getNetworkInfo(),
    processes,
    sensors,
    timestamp: Date.now(),
  };
}

ipcMain.handle('system:get-snapshot', async () => {
  return getSystemSnapshot();
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
